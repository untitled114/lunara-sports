"""
Serializers for SafeSend project management.
Handles projects, milestones, and invitations with PostgreSQL persistence.
"""

from rest_framework import serializers
from django.utils import timezone
from .models import Project, Milestone, ProjectInvitation
from apps.accounts.serializers import UserSerializer


class MilestoneSerializer(serializers.ModelSerializer):
    """Serializer for project milestones."""

    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Milestone
        fields = (
            'id', 'title', 'description', 'amount', 'due_date',
            'status', 'deliverables', 'submission_notes', 'review_notes',
            'order', 'created_at', 'updated_at', 'submitted_at',
            'approved_at', 'is_overdue'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'submitted_at', 'approved_at')

    def validate_due_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError("Due date cannot be in the past.")
        return value


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for projects with milestone data."""

    milestones = MilestoneSerializer(many=True, read_only=True)
    client_info = UserSerializer(source='client', read_only=True)
    freelancer_info = UserSerializer(source='freelancer', read_only=True)
    progress_percentage = serializers.FloatField(read_only=True)
    total_paid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Project
        fields = (
            'id', 'title', 'description', 'total_amount', 'currency',
            'status', 'deadline', 'skills_required', 'attachments',
            'project_type', 'client_info', 'freelancer_info', 'milestones',
            'progress_percentage', 'total_paid', 'created_at', 'updated_at',
            'started_at', 'completed_at'
        )
        read_only_fields = (
            'id', 'client_info', 'freelancer_info', 'progress_percentage',
            'total_paid', 'created_at', 'updated_at', 'started_at', 'completed_at'
        )

    def validate_deadline(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Deadline cannot be in the past.")
        return value


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new projects."""

    class Meta:
        model = Project
        fields = (
            'title', 'description', 'total_amount', 'currency',
            'deadline', 'skills_required', 'project_type'
        )

    def create(self, validated_data):
        # Set the client to the current user
        validated_data['client'] = self.context['request'].user
        return super().create(validated_data)


class ProjectInvitationSerializer(serializers.ModelSerializer):
    """Serializer for project invitations."""

    project_info = ProjectSerializer(source='project', read_only=True)
    freelancer_info = UserSerializer(source='freelancer', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProjectInvitation
        fields = (
            'id', 'project_info', 'freelancer_info', 'status', 'message',
            'created_at', 'expires_at', 'responded_at', 'is_expired'
        )
        read_only_fields = ('id', 'created_at', 'responded_at', 'is_expired')


class MilestoneCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating milestones."""

    class Meta:
        model = Milestone
        fields = ('title', 'description', 'amount', 'due_date', 'order')

    def create(self, validated_data):
        # Set the project from the URL
        project_id = self.context['view'].kwargs.get('project_pk')
        if project_id:
            validated_data['project_id'] = project_id
        return super().create(validated_data)


class MilestoneSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for milestone submissions."""

    class Meta:
        model = Milestone
        fields = ('deliverables', 'submission_notes')

    def update(self, instance, validated_data):
        instance.status = 'submitted'
        instance.submitted_at = timezone.now()
        return super().update(instance, validated_data)


class MilestoneReviewSerializer(serializers.ModelSerializer):
    """Serializer for milestone reviews."""

    approved = serializers.BooleanField(write_only=True)

    class Meta:
        model = Milestone
        fields = ('review_notes', 'approved')

    def update(self, instance, validated_data):
        approved = validated_data.pop('approved')
        if approved:
            instance.status = 'approved'
            instance.approved_at = timezone.now()
        else:
            instance.status = 'revision_requested'
        return super().update(instance, validated_data)