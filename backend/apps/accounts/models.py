"""
User and Profile models for Lunara authentication system.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    """
    USER_TYPE_CHOICES = [
        ('freelancer', 'Freelancer'),
        ('client', 'Client'),
        ('admin', 'Administrator'),
    ]

    email = models.EmailField(unique=True)
    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        default='freelancer'
    )
    is_verified = models.BooleanField(default=False)
    is_demo = models.BooleanField(default=False, help_text="Demo users have pre-populated fake data")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'user_type']

    def __str__(self):
        return f"{self.email} ({self.get_user_type_display()})"

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class Profile(models.Model):
    """
    Extended user profile information.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True, max_length=500)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    # Professional information
    skills = models.JSONField(default=list, blank=True)
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Hourly rate in USD"
    )
    portfolio_url = models.URLField(blank=True)

    # Contact information
    phone = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')

    # Verification and ratings
    is_profile_complete = models.BooleanField(default=False)
    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.00,
        help_text="Average rating from 0.00 to 5.00"
    )
    total_projects = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email}'s Profile"

    def save(self, *args, **kwargs):
        # Auto-check if profile is complete
        self.is_profile_complete = bool(
            self.bio and
            self.skills and
            (self.user.user_type == 'client' or self.hourly_rate)
        )
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'user_profiles'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'


class EmailVerification(models.Model):
    """
    Email verification tokens for user registration.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"Verification for {self.user.email}"

    def is_expired(self):
        return timezone.now() > self.expires_at

    class Meta:
        db_table = 'email_verifications'
        verbose_name = 'Email Verification'
        verbose_name_plural = 'Email Verifications'