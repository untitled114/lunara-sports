"""
Serializers for Lunara payment and escrow management.
"""

from rest_framework import serializers
from .models import EscrowAccount, Transaction, PaymentMethod, Dispute


class EscrowAccountSerializer(serializers.ModelSerializer):
    """
    Serializer for EscrowAccount model.
    """
    available_balance = serializers.ReadOnlyField()
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = EscrowAccount
        fields = [
            'id', 'project', 'project_title', 'total_deposited',
            'total_released', 'total_refunded', 'available_balance',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['total_deposited', 'total_released', 'total_refunded']


class TransactionSerializer(serializers.ModelSerializer):
    """
    Serializer for Transaction model.
    """
    project_title = serializers.CharField(source='escrow_account.project.title', read_only=True)
    milestone_title = serializers.CharField(source='milestone.title', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'escrow_account', 'milestone', 'project_title', 'milestone_title',
            'amount', 'currency', 'transaction_type', 'payment_provider',
            'provider_transaction_id', 'provider_fee', 'status', 'description',
            'metadata', 'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['provider_transaction_id', 'provider_fee', 'completed_at']


class TransactionCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new transactions.
    """
    class Meta:
        model = Transaction
        fields = [
            'escrow_account', 'milestone', 'amount', 'currency',
            'transaction_type', 'payment_provider', 'description'
        ]

    def validate(self, data):
        """Validate transaction data based on type."""
        transaction_type = data.get('transaction_type')
        escrow_account = data.get('escrow_account')

        if transaction_type == 'release' and escrow_account:
            if data.get('amount', 0) > escrow_account.available_balance:
                raise serializers.ValidationError(
                    "Cannot release more than available balance in escrow."
                )

        return data


class PaymentMethodSerializer(serializers.ModelSerializer):
    """
    Serializer for PaymentMethod model.
    """
    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'payment_type', 'provider', 'display_name',
            'is_default', 'is_active', 'created_at'
        ]
        read_only_fields = ['provider_payment_method_id']


class PaymentMethodCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating payment methods.
    """
    class Meta:
        model = PaymentMethod
        fields = [
            'payment_type', 'provider', 'provider_payment_method_id', 'display_name'
        ]


class DisputeSerializer(serializers.ModelSerializer):
    """
    Serializer for Dispute model.
    """
    project_title = serializers.CharField(source='project.title', read_only=True)
    milestone_title = serializers.CharField(source='milestone.title', read_only=True)
    raised_by_email = serializers.CharField(source='raised_by.email', read_only=True)
    resolved_by_email = serializers.CharField(source='resolved_by.email', read_only=True)

    class Meta:
        model = Dispute
        fields = [
            'id', 'project', 'milestone', 'project_title', 'milestone_title',
            'raised_by', 'raised_by_email', 'reason', 'evidence', 'status',
            'resolution_notes', 'resolved_by', 'resolved_by_email',
            'created_at', 'updated_at', 'resolved_at'
        ]
        read_only_fields = ['raised_by', 'resolved_by', 'resolved_at']


class DisputeCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating disputes.
    """
    class Meta:
        model = Dispute
        fields = ['project', 'milestone', 'reason', 'evidence']