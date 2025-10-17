#!/usr/bin/env python
"""
Script to create demo users with fake data for Lunara platform.
This script:
1. Deletes all existing users from the database
2. Creates two demo users with predefined credentials
3. Populates demo users with realistic fake data (projects, milestones, etc.)

Demo users:
- eltrozo@lunara.com / demo12345
- papon@lunara.com / demo12345
"""

import os
import sys
import django
from decimal import Decimal
from datetime import datetime, timedelta
import random

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Lunara.settings.development')
django.setup()

from apps.accounts.models import User, Profile
from apps.projects.models import Project, Milestone
from django.utils import timezone


# Fake data generators
SKILLS = [
    'React', 'Vue.js', 'Angular', 'Node.js', 'Python', 'Django', 'Flask',
    'UI/UX Design', 'Graphic Design', 'Mobile Development', 'iOS', 'Android',
    'DevOps', 'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB',
    'Machine Learning', 'Data Science', 'SEO', 'Content Writing', 'Marketing'
]

PROJECT_TITLES = [
    'E-commerce Platform Redesign',
    'Mobile Banking App',
    'Restaurant Ordering System',
    'Real Estate Marketplace',
    'Social Media Dashboard',
    'Healthcare Portal Development',
    'Fitness Tracking App',
    'Educational Platform',
    'CRM System Integration',
    'Inventory Management System',
    'Video Streaming Platform',
    'Travel Booking Website',
    'AI Chatbot Implementation',
    'Marketing Automation Tool',
    'Portfolio Website Design'
]

PROJECT_DESCRIPTIONS = [
    'Complete redesign of the user interface with modern aesthetics and improved user experience.',
    'Full-stack development with secure authentication and real-time features.',
    'Implementation of payment gateway, user dashboard, and analytics.',
    'Mobile-first responsive design with advanced filtering and search capabilities.',
    'Integration with third-party APIs and custom backend development.',
    'Database optimization and performance improvements for scalability.',
    'Custom admin panel with reporting and data visualization features.',
    'Multi-language support and accessibility compliance.',
]

MILESTONE_TITLES = [
    'Initial Design Mockups',
    'Frontend Development',
    'Backend API Development',
    'Database Design & Setup',
    'User Authentication',
    'Payment Integration',
    'Testing & QA',
    'Deployment & Launch',
    'Bug Fixes & Refinements',
    'Documentation'
]


def delete_all_users():
    """Delete all users from the database."""
    print("\nDeleting all existing users...")
    user_count = User.objects.count()
    User.objects.all().delete()
    print(f"Deleted {user_count} users")


def create_demo_user(email, username, user_type):
    """Create a demo user with profile and fake data."""
    user = User.objects.create_user(
        username=username,
        email=email,
        password='demo12345',
        user_type=user_type,
        is_verified=True,
        is_demo=True
    )

    # Create profile with random data
    profile = Profile.objects.create(
        user=user,
        bio=f"Experienced {user_type} with 5+ years in the industry. Specialized in delivering high-quality projects on time and within budget.",
        skills=random.sample(SKILLS, k=random.randint(5, 10)),
        hourly_rate=Decimal(str(random.randint(50, 150))),
        phone=f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
        timezone='America/New_York',
        is_profile_complete=True,
        average_rating=Decimal(str(round(random.uniform(4.0, 5.0), 2))),
        total_projects=random.randint(15, 50)
    )

    print(f"Created demo user: {email} ({user_type})")
    return user


def create_fake_projects_for_user(user, count=5):
    """Create fake projects for a demo user."""
    projects = []
    statuses = ['active', 'completed', 'active', 'completed', 'active']

    for i in range(count):
        # Randomly decide if user is client or freelancer for this project
        is_client = random.choice([True, False]) if user.user_type == 'freelancer' else True

        # Create a second demo user for the other role (if needed)
        other_user = User.objects.filter(is_demo=True).exclude(id=user.id).first()

        if not other_user:
            # Create a temporary demo user for the other role
            other_type = 'client' if not is_client else 'freelancer'
            other_user = User.objects.create_user(
                username=f'demo_user_{i}',
                email=f'demo_{i}@lunara.com',
                password='demo12345',
                user_type=other_type,
                is_verified=True,
                is_demo=True
            )

        # Determine project timeline
        days_ago = random.randint(30, 180)
        created_date = timezone.now() - timedelta(days=days_ago)
        deadline_days = random.randint(30, 90)
        deadline = created_date + timedelta(days=deadline_days)

        status = statuses[i] if i < len(statuses) else random.choice(['active', 'completed'])

        project = Project.objects.create(
            title=random.choice(PROJECT_TITLES),
            description=random.choice(PROJECT_DESCRIPTIONS),
            client=user if is_client else other_user,
            freelancer=other_user if is_client else user,
            total_amount=Decimal(str(random.randint(1000, 10000))),
            currency='USD',
            status=status,
            deadline=deadline,
            started_at=created_date + timedelta(days=2),
            completed_at=timezone.now() - timedelta(days=random.randint(1, 30)) if status == 'completed' else None,
            skills_required=random.sample(SKILLS, k=random.randint(3, 6)),
            project_type=random.choice(['fixed', 'hourly'])
        )

        projects.append(project)

        # Create milestones for this project
        create_milestones_for_project(project)

    print(f"Created {count} fake projects for {user.email}")
    return projects


def create_milestones_for_project(project):
    """Create fake milestones for a project."""
    num_milestones = random.randint(3, 6)
    milestone_amount = project.total_amount / num_milestones

    for i in range(num_milestones):
        # Determine milestone status based on project status
        if project.status == 'completed':
            status = 'approved'
        elif project.status == 'active':
            statuses = ['approved', 'approved', 'in_progress', 'pending']
            status = statuses[i] if i < len(statuses) else 'pending'
        else:
            status = 'pending'

        # Calculate milestone dates
        days_offset = i * 15  # 15 days between milestones
        due_date = project.started_at + timedelta(days=days_offset + random.randint(10, 20))

        milestone = Milestone.objects.create(
            project=project,
            title=MILESTONE_TITLES[i % len(MILESTONE_TITLES)],
            description=f"Detailed description for milestone: {MILESTONE_TITLES[i % len(MILESTONE_TITLES)]}",
            amount=milestone_amount,
            due_date=due_date,
            status=status,
            order=i + 1,
            submitted_at=due_date - timedelta(days=2) if status in ['approved', 'submitted'] else None,
            approved_at=due_date if status == 'approved' else None,
            submission_notes="Work completed as per requirements." if status in ['approved', 'submitted'] else "",
            review_notes="Great work! Approved." if status == 'approved' else ""
        )


def main():
    """Main function to set up demo data."""
    print("\n" + "="*60)
    print("LUNARA DEMO USER SETUP")
    print("="*60)

    # Step 1: Delete all existing users
    delete_all_users()

    # Step 2: Create demo users
    print("\nCreating demo users...")
    user1 = create_demo_user('eltrozo@lunara.com', 'eltrozo', 'freelancer')
    user2 = create_demo_user('papon@lunara.com', 'papon', 'client')

    # Step 3: Generate fake data for demo users
    print("\nGenerating fake data for demo users...")
    create_fake_projects_for_user(user1, count=6)
    create_fake_projects_for_user(user2, count=4)

    # Summary
    print("\n" + "="*60)
    print("DEMO SETUP COMPLETE!")
    print("="*60)
    print("\nDEMO USER CREDENTIALS:")
    print("\nUser 1:")
    print(f"  Email: eltrozo@lunara.com")
    print(f"  Password: demo12345")
    print(f"  Type: Freelancer")

    print("\nUser 2:")
    print(f"  Email: papon@lunara.com")
    print(f"  Password: demo12345")
    print(f"  Type: Client")

    print("\nBoth users have pre-populated fake data including:")
    print("  - Complete profiles")
    print("  - Multiple projects (active and completed)")
    print("  - Project milestones")
    print("  - Realistic ratings and statistics")

    print("\nIMPORTANT: Only demo users have fake data.")
    print("All new users will start fresh.\n")


if __name__ == '__main__':
    main()
