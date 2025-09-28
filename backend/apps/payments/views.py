"""
Views for Lunara payment and escrow management.
Handles transactions, escrow accounts, and payment methods with PostgreSQL persistence.
"""

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from .models import EscrowAccount, Transaction, PaymentMethod, Dispute
from .serializers import (
    EscrowAccountSerializer, TransactionSerializer, TransactionCreateSerializer,
    PaymentMethodSerializer, PaymentMethodCreateSerializer,
    DisputeSerializer, DisputeCreateSerializer
)


class EscrowAccountListView(generics.ListAPIView):
    """
    List escrow accounts for authenticated user's projects.
    Returns data from PostgreSQL based on user role.
    """
    serializer_class = EscrowAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return EscrowAccount.objects.filter(project__freelancer=user)
        else:
            return EscrowAccount.objects.filter(project__client=user)


class TransactionListCreateView(generics.ListCreateAPIView):
    """
    List transactions and create new transactions.
    Queries PostgreSQL for user's transaction history.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return Transaction.objects.filter(escrow_account__project__freelancer=user)
        else:
            return Transaction.objects.filter(escrow_account__project__client=user)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TransactionCreateSerializer
        return TransactionSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        """Create transaction with escrow balance updates."""
        transaction_obj = serializer.save()
        escrow = transaction_obj.escrow_account

        # Update escrow balance based on transaction type
        if transaction_obj.transaction_type == 'deposit':
            escrow.total_deposited += transaction_obj.amount
        elif transaction_obj.transaction_type == 'release':
            escrow.total_released += transaction_obj.amount
        elif transaction_obj.transaction_type == 'refund':
            escrow.total_refunded += transaction_obj.amount

        escrow.save()

        # Set transaction as completed for demo purposes
        # In production, this would be handled by payment provider webhooks
        transaction_obj.status = 'completed'
        transaction_obj.completed_at = timezone.now()
        transaction_obj.save()


class TransactionDetailView(generics.RetrieveAPIView):
    """
    Retrieve a specific transaction.
    Returns detailed transaction data from PostgreSQL.
    """
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return Transaction.objects.filter(escrow_account__project__freelancer=user)
        else:
            return Transaction.objects.filter(escrow_account__project__client=user)


class PaymentMethodListCreateView(generics.ListCreateAPIView):
    """
    List and create payment methods for authenticated user.
    Stores payment method data in PostgreSQL.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PaymentMethod.objects.filter(user=self.request.user, is_active=True)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PaymentMethodCreateSerializer
        return PaymentMethodSerializer

    def perform_create(self, serializer):
        """Create payment method for authenticated user."""
        payment_method = serializer.save(user=self.request.user)

        # If this is the user's first payment method, make it default
        if not PaymentMethod.objects.filter(user=self.request.user, is_default=True).exists():
            payment_method.is_default = True
            payment_method.save()


class PaymentMethodDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a payment method.
    Manages payment method data in PostgreSQL.
    """
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PaymentMethod.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        """Soft delete payment method."""
        instance.is_active = False
        instance.save()


class DisputeListCreateView(generics.ListCreateAPIView):
    """
    List and create disputes for authenticated user.
    Handles dispute management with PostgreSQL persistence.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return Dispute.objects.filter(project__freelancer=user)
        else:
            return Dispute.objects.filter(project__client=user)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DisputeCreateSerializer
        return DisputeSerializer

    def perform_create(self, serializer):
        """Create dispute for authenticated user."""
        serializer.save(raised_by=self.request.user)


class DisputeDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve and update dispute details.
    Manages dispute resolution in PostgreSQL.
    """
    serializer_class = DisputeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'freelancer':
            return Dispute.objects.filter(project__freelancer=user)
        else:
            return Dispute.objects.filter(project__client=user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def deposit_funds(request, project_id):
    """
    Deposit funds into project escrow account.
    Creates escrow account if it doesn't exist and processes deposit.
    """
    from apps.projects.models import Project

    project = get_object_or_404(Project, id=project_id, client=request.user)
    amount = request.data.get('amount')
    payment_method_id = request.data.get('payment_method_id')

    if not amount or Decimal(amount) <= 0:
        return Response(
            {'error': 'Valid amount is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get or create escrow account
    escrow_account, created = EscrowAccount.objects.get_or_create(
        project=project,
        defaults={'is_active': True}
    )

    # Create deposit transaction
    with transaction.atomic():
        deposit_transaction = Transaction.objects.create(
            escrow_account=escrow_account,
            amount=Decimal(amount),
            transaction_type='deposit',
            payment_provider='stripe',  # Default provider
            provider_transaction_id=f'dep_{timezone.now().timestamp()}',
            status='completed',
            completed_at=timezone.now(),
            description=f'Deposit for project: {project.title}'
        )

        # Update escrow balance
        escrow_account.total_deposited += Decimal(amount)
        escrow_account.save()

    return Response({
        'message': 'Funds deposited successfully',
        'transaction_id': deposit_transaction.id,
        'escrow_balance': escrow_account.available_balance
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def release_milestone_payment(request, project_id, milestone_id):
    """
    Release payment for completed milestone.
    Transfers funds from escrow to freelancer.
    """
    from apps.projects.models import Project, Milestone

    project = get_object_or_404(Project, id=project_id, client=request.user)
    milestone = get_object_or_404(Milestone, id=milestone_id, project=project, status='approved')

    try:
        escrow_account = project.escrow
    except EscrowAccount.DoesNotExist:
        return Response(
            {'error': 'No escrow account found for this project'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if milestone.amount > escrow_account.available_balance:
        return Response(
            {'error': 'Insufficient funds in escrow'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create release transaction
    with transaction.atomic():
        release_transaction = Transaction.objects.create(
            escrow_account=escrow_account,
            milestone=milestone,
            amount=milestone.amount,
            transaction_type='release',
            payment_provider='stripe',
            provider_transaction_id=f'rel_{timezone.now().timestamp()}',
            status='completed',
            completed_at=timezone.now(),
            description=f'Payment release for milestone: {milestone.title}'
        )

        # Update escrow balance
        escrow_account.total_released += milestone.amount
        escrow_account.save()

    return Response({
        'message': 'Payment released successfully',
        'transaction_id': release_transaction.id,
        'amount_released': milestone.amount,
        'remaining_balance': escrow_account.available_balance
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payment_dashboard(request):
    """
    Get payment dashboard data for authenticated user.
    Returns financial statistics from PostgreSQL.
    """
    user = request.user

    if user.user_type == 'freelancer':
        # Freelancer earnings and pending payments
        transactions = Transaction.objects.filter(
            escrow_account__project__freelancer=user,
            transaction_type='release',
            status='completed'
        )
        total_earned = sum(t.amount for t in transactions)

        pending_milestones = user.freelancer_projects.filter(
            milestones__status='submitted'
        ).count()

        active_escrows = EscrowAccount.objects.filter(
            project__freelancer=user,
            is_active=True
        ).count()

    else:
        # Client spending and deposits
        transactions = Transaction.objects.filter(
            escrow_account__project__client=user,
            transaction_type='deposit',
            status='completed'
        )
        total_earned = sum(t.amount for t in transactions)

        pending_milestones = user.client_projects.filter(
            milestones__status='submitted'
        ).count()

        active_escrows = EscrowAccount.objects.filter(
            project__client=user,
            is_active=True
        ).count()

    if user.user_type == 'client':
        recent_transactions = Transaction.objects.filter(
            escrow_account__project__client=user
        ).order_by('-created_at')[:5]
    else:
        recent_transactions = Transaction.objects.filter(
            escrow_account__project__freelancer=user
        ).order_by('-created_at')[:5]

    return Response({
        'total_amount': float(total_earned),
        'pending_payments': pending_milestones,
        'active_escrows': active_escrows,
        'recent_transactions': TransactionSerializer(recent_transactions, many=True).data
    })