"""
Views for SafeSend user account management.
Handles authentication, registration, and profile management with PostgreSQL persistence.
"""

from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import User, Profile
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, UserSerializer,
    ProfileSerializer, TokenSerializer, EmailCheckSerializer,
    UsernameCheckSerializer
)


@method_decorator(csrf_exempt, name='dispatch')
class UserRegistrationView(generics.CreateAPIView):
    """
    Register a new user with automatic profile creation.
    Creates user and profile in PostgreSQL with transaction safety.
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        tokens = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }

        return Response(tokens, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class UserLoginView(generics.GenericAPIView):
    """
    Authenticate user and return JWT tokens.
    Validates against PostgreSQL and returns persistent tokens.
    """
    serializer_class = UserLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        tokens = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }

        return Response(tokens, status=status.HTTP_200_OK)


class UserProfileView(generics.RetrieveAPIView):
    """
    Get current user profile from PostgreSQL.
    Returns user data with profile information.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileUpdateView(generics.UpdateAPIView):
    """
    Update user profile in PostgreSQL.
    Handles partial updates with automatic profile completion checking.
    """
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        # Save to PostgreSQL with automatic profile completion check
        serializer.save()


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def check_email_availability(request):
    """
    Check if email is available for registration.
    Queries PostgreSQL for existing emails.
    """
    serializer = EmailCheckSerializer(data=request.query_params)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        exists = User.objects.filter(email=email).exists()
        return Response({
            'email': email,
            'available': not exists
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def check_username_availability(request):
    """
    Check if username is available for registration.
    Queries PostgreSQL for existing usernames.
    """
    serializer = UsernameCheckSerializer(data=request.query_params)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        exists = User.objects.filter(username=username).exists()
        return Response({
            'username': username,
            'available': not exists
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """
    Logout user by blacklisting refresh token.
    Ensures secure token invalidation.
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """
    Get dashboard statistics for authenticated user.
    Returns real-time data from PostgreSQL for dashboard display.
    """
    user = request.user

    # Import here to avoid circular imports
    from apps.projects.models import Project, Milestone
    from apps.payments.models import Transaction

    # Get user's projects from PostgreSQL
    if user.user_type == 'freelancer':
        projects = Project.objects.filter(freelancer=user)
    else:
        projects = Project.objects.filter(client=user)

    # Calculate real statistics
    active_projects = projects.filter(status='active').count()
    completed_projects = projects.filter(status='completed').count()
    total_projects = projects.count()

    # Get milestone statistics
    if user.user_type == 'freelancer':
        milestones = Milestone.objects.filter(project__freelancer=user)
        overdue_tasks = milestones.filter(status__in=['pending', 'in_progress']).count()
        due_today = milestones.filter(status='in_progress').count()
    else:
        milestones = Milestone.objects.filter(project__client=user)
        overdue_tasks = milestones.filter(status='submitted').count()
        due_today = milestones.filter(status='revision_requested').count()

    # Calculate earnings (for freelancers) or spending (for clients)
    if user.user_type == 'freelancer':
        completed_milestones = milestones.filter(status='approved')
        total_earned = sum(m.amount for m in completed_milestones)
        pending_payments = milestones.filter(status='submitted').count()
    else:
        total_earned = 0
        pending_payments = milestones.filter(status='approved').count()

    # Calculate success rate
    if total_projects > 0:
        success_rate = (completed_projects / total_projects) * 100
    else:
        success_rate = 0

    return Response({
        'active_projects': active_projects,
        'completed_projects': completed_projects,
        'total_projects': total_projects,
        'overdue_tasks': overdue_tasks,
        'due_today': due_today,
        'total_earned': float(total_earned),
        'pending_payments': pending_payments,
        'success_rate': round(success_rate, 1),
        'week_progress': min(76, success_rate)  # Placeholder calculation
    })