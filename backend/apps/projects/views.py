"""
Views for Lunara project management.
Handles projects, milestones, and invitations with PostgreSQL persistence.
"""

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import Project, Milestone, ProjectInvitation
from .serializers import (
    ProjectSerializer, ProjectCreateSerializer, MilestoneSerializer,
    MilestoneCreateSerializer, MilestoneSubmissionSerializer,
    MilestoneReviewSerializer, ProjectInvitationSerializer
)


class ProjectListCreateView(generics.ListCreateAPIView):
    """
    List all projects for authenticated user or create new project.
    Queries PostgreSQL for user's projects based on role.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return Project.objects.filter(freelancer=user).order_by('-created_at')
        else:
            return Project.objects.filter(client=user).order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProjectCreateSerializer
        return ProjectSerializer


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a project.
    Includes milestone data from PostgreSQL.
    """
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return Project.objects.filter(freelancer=user)
        else:
            return Project.objects.filter(client=user)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_projects(request):
    """
    Get projects filtered by status and role.
    Returns real-time data from PostgreSQL.
    """
    user = request.user
    status_filter = request.query_params.get('status')

    # Get base queryset based on user type
    if user.user_type == 'freelancer':
        projects = Project.objects.filter(freelancer=user)
    else:
        projects = Project.objects.filter(client=user)

    # Apply status filter if provided
    if status_filter:
        projects = projects.filter(status=status_filter)

    projects = projects.order_by('-created_at')
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def assign_freelancer(request, pk):
    """
    Assign a freelancer to a project.
    Updates PostgreSQL with transaction safety.
    """
    project = get_object_or_404(Project, pk=pk, client=request.user)
    freelancer_id = request.data.get('freelancer_id')

    if not freelancer_id:
        return Response({'error': 'Freelancer ID required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from apps.accounts.models import User
        freelancer = User.objects.get(id=freelancer_id, user_type='freelancer')

        with transaction.atomic():
            project.freelancer = freelancer
            project.status = 'active'
            project.started_at = timezone.now()
            project.save()

        serializer = ProjectSerializer(project)
        return Response(serializer.data)

    except User.DoesNotExist:
        return Response({'error': 'Freelancer not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def complete_project(request, pk):
    """
    Mark project as completed.
    Updates status in PostgreSQL.
    """
    user = request.user

    # Allow both client and freelancer to mark as complete
    if user.user_type == 'freelancer':
        project = get_object_or_404(Project, pk=pk, freelancer=user)
    else:
        project = get_object_or_404(Project, pk=pk, client=user)

    with transaction.atomic():
        project.status = 'completed'
        project.completed_at = timezone.now()
        project.save()

    serializer = ProjectSerializer(project)
    return Response(serializer.data)


class MilestoneListCreateView(generics.ListCreateAPIView):
    """
    List milestones for a project or create new milestone.
    Queries PostgreSQL for project milestones.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get('project_pk')
        return Milestone.objects.filter(project_id=project_id).order_by('order', 'due_date')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MilestoneCreateSerializer
        return MilestoneSerializer

    def perform_create(self, serializer):
        project_id = self.kwargs.get('project_pk')
        project = get_object_or_404(Project, pk=project_id)

        # Verify user has permission to create milestones
        user = self.request.user
        if user != project.client and user != project.freelancer:
            raise permissions.PermissionDenied()

        serializer.save(project=project)


class MilestoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a milestone.
    Direct PostgreSQL operations for milestone management.
    """
    serializer_class = MilestoneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs.get('project_pk')
        return Milestone.objects.filter(project_id=project_id)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_milestone(request, project_pk, pk):
    """
    Submit milestone deliverables.
    Updates milestone status in PostgreSQL.
    """
    milestone = get_object_or_404(Milestone, pk=pk, project_id=project_pk)

    # Only freelancer can submit
    if request.user != milestone.project.freelancer:
        return Response({'error': 'Only assigned freelancer can submit'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MilestoneSubmissionSerializer(milestone, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(MilestoneSerializer(milestone).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def review_milestone(request, project_pk, pk):
    """
    Review and approve/reject milestone.
    Updates milestone status in PostgreSQL with client decision.
    """
    milestone = get_object_or_404(Milestone, pk=pk, project_id=project_pk)

    # Only client can review
    if request.user != milestone.project.client:
        return Response({'error': 'Only project client can review'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MilestoneReviewSerializer(milestone, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(MilestoneSerializer(milestone).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_milestone(request, project_pk, pk):
    """
    Start working on a milestone.
    Updates milestone status to in_progress in PostgreSQL.
    """
    milestone = get_object_or_404(Milestone, pk=pk, project_id=project_pk)

    # Only freelancer can start
    if request.user != milestone.project.freelancer:
        return Response({'error': 'Only assigned freelancer can start milestone'}, status=status.HTTP_403_FORBIDDEN)

    if milestone.status != 'pending':
        return Response({'error': 'Milestone is not in pending status'}, status=status.HTTP_400_BAD_REQUEST)

    milestone.status = 'in_progress'
    milestone.save()

    return Response(MilestoneSerializer(milestone).data)


class ProjectInvitationListCreateView(generics.ListCreateAPIView):
    """
    List project invitations or create new invitation.
    Manages freelancer invitations in PostgreSQL.
    """
    serializer_class = ProjectInvitationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return ProjectInvitation.objects.filter(freelancer=user).order_by('-created_at')
        else:
            return ProjectInvitation.objects.filter(project__client=user).order_by('-created_at')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def accept_invitation(request, pk):
    """
    Accept project invitation.
    Updates invitation and project status in PostgreSQL.
    """
    invitation = get_object_or_404(ProjectInvitation, pk=pk, freelancer=request.user)

    if invitation.status != 'pending':
        return Response({'error': 'Invitation already responded to'}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.is_expired:
        return Response({'error': 'Invitation has expired'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        invitation.status = 'accepted'
        invitation.responded_at = timezone.now()
        invitation.save()

        # Assign freelancer to project
        project = invitation.project
        project.freelancer = invitation.freelancer
        project.status = 'active'
        project.started_at = timezone.now()
        project.save()

    return Response(ProjectInvitationSerializer(invitation).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def decline_invitation(request, pk):
    """
    Decline project invitation.
    Updates invitation status in PostgreSQL.
    """
    invitation = get_object_or_404(ProjectInvitation, pk=pk, freelancer=request.user)

    if invitation.status != 'pending':
        return Response({'error': 'Invitation already responded to'}, status=status.HTTP_400_BAD_REQUEST)

    invitation.status = 'declined'
    invitation.responded_at = timezone.now()
    invitation.save()

    return Response(ProjectInvitationSerializer(invitation).data)