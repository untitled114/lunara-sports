"""
Payment and Escrow models for SafeSend financial transactions.
"""

from django.db import models
from django.conf import settings
from decimal import Decimal


class EscrowAccount(models.Model):
    """
    Escrow account for holding project funds securely.
    """
    project = models.OneToOneField('projects.Project', on_delete=models.CASCADE, related_name='escrow')

    # Financial tracking
    total_deposited = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_released = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_refunded = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # External payment provider IDs
    stripe_account_id = models.CharField(max_length=100, blank=True)
    paypal_account_id = models.CharField(max_length=100, blank=True)

    # Account status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Escrow for {self.project.title}"

    @property
    def available_balance(self):
        """Calculate available balance in escrow."""
        return self.total_deposited - self.total_released - self.total_refunded

    class Meta:
        db_table = 'escrow_accounts'
        verbose_name = 'Escrow Account'
        verbose_name_plural = 'Escrow Accounts'


class Transaction(models.Model):
    """
    Individual financial transactions in the system.
    """
    TRANSACTION_TYPES = [
        ('deposit', 'Deposit'),
        ('release', 'Release'),
        ('refund', 'Refund'),
        ('fee', 'Platform Fee'),
        ('chargeback', 'Chargeback'),
    ]

    PAYMENT_PROVIDERS = [
        ('stripe', 'Stripe'),
        ('paypal', 'PayPal'),
        ('venmo', 'Venmo'),
        ('manual', 'Manual'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    # Core transaction information
    escrow_account = models.ForeignKey(EscrowAccount, on_delete=models.CASCADE, related_name='transactions')
    milestone = models.ForeignKey('projects.Milestone', on_delete=models.CASCADE, null=True, blank=True)

    # Transaction details
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)

    # Payment provider information
    payment_provider = models.CharField(max_length=20, choices=PAYMENT_PROVIDERS)
    provider_transaction_id = models.CharField(max_length=200, unique=True)
    provider_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Status and timeline
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Additional information
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # For storing provider-specific data

    def __str__(self):
        return f"{self.get_transaction_type_display()} - ${self.amount}"

    class Meta:
        db_table = 'transactions'
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-created_at']


class PaymentMethod(models.Model):
    """
    Stored payment methods for users.
    """
    PAYMENT_TYPES = [
        ('card', 'Credit/Debit Card'),
        ('bank', 'Bank Account'),
        ('paypal', 'PayPal'),
        ('venmo', 'Venmo'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_methods')

    # Payment method details
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPES)
    provider = models.CharField(max_length=20, choices=Transaction.PAYMENT_PROVIDERS)
    provider_payment_method_id = models.CharField(max_length=200)

    # Display information (last 4 digits, etc.)
    display_name = models.CharField(max_length=100)  # e.g., "**** 4242"

    # Status
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {self.display_name}"

    class Meta:
        db_table = 'payment_methods'
        verbose_name = 'Payment Method'
        verbose_name_plural = 'Payment Methods'


class Dispute(models.Model):
    """
    Dispute handling for project payments.
    """
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('resolved_client', 'Resolved - Client Favor'),
        ('resolved_freelancer', 'Resolved - Freelancer Favor'),
        ('resolved_split', 'Resolved - Split Decision'),
        ('closed', 'Closed'),
    ]

    # Dispute details
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='disputes')
    milestone = models.ForeignKey('projects.Milestone', on_delete=models.CASCADE, null=True, blank=True)
    raised_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='raised_disputes')

    # Dispute information
    reason = models.TextField()
    evidence = models.JSONField(default=list, blank=True)  # File URLs and descriptions
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')

    # Resolution
    resolution_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_disputes'
    )

    # Timeline
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Dispute: {self.project.title}"

    class Meta:
        db_table = 'disputes'
        verbose_name = 'Dispute'
        verbose_name_plural = 'Disputes'
        ordering = ['-created_at']