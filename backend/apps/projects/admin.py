from django.contrib import admin
from .models import Project, Milestone, ProjectInvitation

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'freelancer', 'status', 'total_amount', 'deadline', 'created_at')
    list_filter = ('status', 'created_at', 'deadline')
    search_fields = ('title', 'client__email', 'freelancer__email')

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'status', 'amount', 'due_date', 'created_at')
    list_filter = ('status', 'created_at', 'due_date')
    search_fields = ('title', 'project__title')

@admin.register(ProjectInvitation)
class ProjectInvitationAdmin(admin.ModelAdmin):
    list_display = ('project', 'freelancer', 'status', 'created_at', 'expires_at')
    list_filter = ('status', 'created_at')
    search_fields = ('project__title', 'freelancer__email')