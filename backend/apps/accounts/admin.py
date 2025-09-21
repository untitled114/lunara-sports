"""
Django admin configuration for accounts app.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, Profile, EmailVerification


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Custom User admin interface.
    """
    list_display = ('email', 'username', 'user_type', 'is_verified', 'is_active', 'date_joined')
    list_filter = ('user_type', 'is_verified', 'is_active', 'is_staff', 'date_joined')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    fieldsets = BaseUserAdmin.fieldsets + (
        ('SafeSend Information', {
            'fields': ('user_type', 'is_verified')
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('SafeSend Information', {
            'fields': ('email', 'user_type')
        }),
    )


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """
    Profile admin interface.
    """
    list_display = ('user_email', 'user_type', 'is_profile_complete', 'average_rating', 'total_projects')
    list_filter = ('is_profile_complete', 'user__user_type', 'created_at')
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('is_profile_complete', 'created_at', 'updated_at')

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'

    def user_type(self, obj):
        return obj.user.get_user_type_display()
    user_type.short_description = 'User Type'


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    """
    Email verification admin interface.
    """
    list_display = ('user_email', 'token_preview', 'created_at', 'expires_at', 'is_used', 'is_expired_status')
    list_filter = ('is_used', 'created_at')
    search_fields = ('user__email', 'token')
    readonly_fields = ('created_at',)

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'

    def token_preview(self, obj):
        return f"{obj.token[:10]}..."
    token_preview.short_description = 'Token'

    def is_expired_status(self, obj):
        if obj.is_expired():
            return format_html('<span style="color: red;">Expired</span>')
        return format_html('<span style="color: green;">Valid</span>')
    is_expired_status.short_description = 'Status'