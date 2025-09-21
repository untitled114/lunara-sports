"""
URL configuration for SafeSend projects API.
All project and milestone management endpoints.
"""

from django.urls import path, include
from . import views
from . import file_views

app_name = 'projects'

# Milestone URLs (nested under projects)
milestone_patterns = [
    path('', views.MilestoneListCreateView.as_view(), name='milestone-list-create'),
    path('<int:pk>/', views.MilestoneDetailView.as_view(), name='milestone-detail'),
    path('<int:pk>/submit/', views.submit_milestone, name='milestone-submit'),
    path('<int:pk>/review/', views.review_milestone, name='milestone-review'),
    path('<int:pk>/start/', views.start_milestone, name='milestone-start'),
]

urlpatterns = [
    # Project endpoints
    path('', views.ProjectListCreateView.as_view(), name='project-list-create'),
    path('<int:pk>/', views.ProjectDetailView.as_view(), name='project-detail'),
    path('my_projects/', views.my_projects, name='my-projects'),
    path('<int:pk>/assign_freelancer/', views.assign_freelancer, name='assign-freelancer'),
    path('<int:pk>/complete_project/', views.complete_project, name='complete-project'),

    # Nested milestone endpoints
    path('<int:project_pk>/milestones/', include((milestone_patterns, 'milestones'))),

    # Project invitation endpoints
    path('invitations/', views.ProjectInvitationListCreateView.as_view(), name='invitation-list-create'),
    path('invitations/<int:pk>/accept/', views.accept_invitation, name='accept-invitation'),
    path('invitations/<int:pk>/decline/', views.decline_invitation, name='decline-invitation'),

    # File upload endpoints
    path('<int:project_id>/files/', file_views.list_project_files, name='project-files-list'),
    path('<int:project_id>/files/upload/', file_views.upload_project_file, name='project-file-upload'),
    path('<int:project_id>/files/<int:file_index>/delete/', file_views.delete_project_file, name='project-file-delete'),
]