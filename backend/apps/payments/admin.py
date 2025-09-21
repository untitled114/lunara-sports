from django.contrib import admin
from .models import EscrowAccount, Transaction, PaymentMethod, Dispute

@admin.register(EscrowAccount)
class EscrowAccountAdmin(admin.ModelAdmin):
    list_display = ('project', 'total_deposited', 'total_released', 'available_balance', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('project__title',)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('provider_transaction_id', 'transaction_type', 'amount', 'status', 'payment_provider', 'created_at')
    list_filter = ('transaction_type', 'status', 'payment_provider', 'created_at')
    search_fields = ('provider_transaction_id', 'escrow_account__project__title')

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ('user', 'payment_type', 'display_name', 'provider', 'is_default', 'is_active')
    list_filter = ('payment_type', 'provider', 'is_active', 'created_at')
    search_fields = ('user__email', 'display_name')

@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('project', 'raised_by', 'status', 'created_at', 'resolved_at')
    list_filter = ('status', 'created_at', 'resolved_at')
    search_fields = ('project__title', 'raised_by__email')