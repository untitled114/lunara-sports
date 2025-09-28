"""
File upload views for Lunara projects.
Handles file uploads with PostgreSQL storage integration.
"""

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.conf import settings
from django.utils import timezone
import os
import uuid

from .models import Project


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_project_file(request, project_id):
    """
    Upload file attachment for a project.
    Stores file securely and updates project record in PostgreSQL.
    """
    project = get_object_or_404(Project, id=project_id)

    # Check user permission
    user = request.user
    if user != project.client and user != project.freelancer:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    uploaded_file = request.FILES['file']

    # Validate file size (5MB limit)
    if uploaded_file.size > 5 * 1024 * 1024:
        return Response({'error': 'File too large. Maximum size is 5MB.'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate file type
    allowed_types = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/zip'
    ]

    if uploaded_file.content_type not in allowed_types:
        return Response({'error': 'File type not allowed'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Generate unique filename
        file_extension = os.path.splitext(uploaded_file.name)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = f"projects/{project_id}/{unique_filename}"

        # Save file
        saved_path = default_storage.save(file_path, uploaded_file)
        file_url = default_storage.url(saved_path)

        # Update project attachments in PostgreSQL
        attachments = project.attachments or []
        attachment_data = {
            'name': uploaded_file.name,
            'path': saved_path,
            'url': file_url,
            'size': uploaded_file.size,
            'content_type': uploaded_file.content_type,
            'uploaded_by': user.username,
            'uploaded_at': str(timezone.now())
        }
        attachments.append(attachment_data)
        project.attachments = attachments
        project.save()

        return Response({
            'message': 'File uploaded successfully',
            'file': attachment_data
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({'error': f'Upload failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_project_files(request, project_id):
    """
    List all files for a project.
    Returns file metadata from PostgreSQL.
    """
    project = get_object_or_404(Project, id=project_id)

    # Check user permission
    user = request.user
    if user != project.client and user != project.freelancer:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    attachments = project.attachments or []
    return Response({'files': attachments})


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_project_file(request, project_id, file_index):
    """
    Delete a project file.
    Removes file from storage and updates PostgreSQL record.
    """
    project = get_object_or_404(Project, id=project_id)

    # Check user permission
    user = request.user
    if user != project.client and user != project.freelancer:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    attachments = project.attachments or []

    try:
        file_index = int(file_index)
        if file_index < 0 or file_index >= len(attachments):
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get file data
        file_data = attachments[file_index]

        # Delete physical file
        if default_storage.exists(file_data['path']):
            default_storage.delete(file_data['path'])

        # Remove from attachments list and update PostgreSQL
        attachments.pop(file_index)
        project.attachments = attachments
        project.save()

        return Response({'message': 'File deleted successfully'})

    except (ValueError, IndexError):
        return Response({'error': 'Invalid file index'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f'Delete failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)