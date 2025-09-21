"""
Project and Milestone models for SafeSend project management.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal


class Project(models.Model):
    """
    Main project model containing all project information.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('disputed', 'Disputed'),
        ('paused', 'Paused'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()

    # Project participants
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='client_projects'
    )
    freelancer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='freelancer_projects',
        null=True,
        blank=True
    )

    # Financial information
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')

    # Project status and timeline
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    deadline = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Additional project details
    skills_required = models.JSONField(default=list, blank=True)
    attachments = models.JSONField(default=list, blank=True)  # File URLs
    project_type = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"{self.title} - {self.client.email}"

    @property
    def progress_percentage(self):
        """Calculate project progress based on completed milestones."""
        total_milestones = self.milestones.count()
        if total_milestones == 0:
            return 0
        completed_milestones = self.milestones.filter(status='approved').count()
        return round((completed_milestones / total_milestones) * 100, 2)

    @property
    def total_paid(self):
        """Calculate total amount paid to freelancer."""
        return self.milestones.filter(status='approved').aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')

    class Meta:
        db_table = 'projects'
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'
        ordering = ['-created_at']


class Milestone(models.Model):
    """
    Project milestones with deliverables and payment information.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('revision_requested', 'Revision Requested'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    title = models.CharField(max_length=200)
    description = models.TextField()

    # Financial information
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    # Timeline
    due_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    # Status and deliverables
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    deliverables = models.JSONField(default=list, blank=True)  # File URLs and descriptions
    submission_notes = models.TextField(blank=True)
    review_notes = models.TextField(blank=True)

    # Order within project
    order = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.project.title} - {self.title}"

    @property
    def is_overdue(self):
        """Check if milestone is overdue."""
        return timezone.now() > self.due_date and self.status not in ['approved', 'rejected']

    class Meta:
        db_table = 'milestones'
        verbose_name = 'Milestone'
        verbose_name_plural = 'Milestones'
        ordering = ['project', 'order', 'due_date']
        unique_together = ['project', 'order']


class ProjectInvitation(models.Model):
    """
    Invitations sent from clients to freelancers for projects.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='invitations')
    freelancer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_invitations'
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Invitation: {self.project.title} to {self.freelancer.email}"

    @property
    def is_expired(self):
        """Check if invitation has expired."""
        return timezone.now() > self.expires_at

    class Meta:
        db_table = 'project_invitations'
        verbose_name = 'Project Invitation'
        verbose_name_plural = 'Project Invitations'
        unique_together = ['project', 'freelancer']