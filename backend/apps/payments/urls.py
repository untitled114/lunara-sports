"""
URL configuration for Lunara payments API.
All payment, escrow, and transaction management endpoints.
"""

from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    # Escrow account endpoints
    path('escrow/', views.EscrowAccountListView.as_view(), name='escrow-list'),

    # Transaction endpoints
    path('transactions/', views.TransactionListCreateView.as_view(), name='transaction-list-create'),
    path('transactions/<int:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),

    # Payment method endpoints
    path('payment-methods/', views.PaymentMethodListCreateView.as_view(), name='payment-method-list-create'),
    path('payment-methods/<int:pk>/', views.PaymentMethodDetailView.as_view(), name='payment-method-detail'),

    # Dispute endpoints
    path('disputes/', views.DisputeListCreateView.as_view(), name='dispute-list-create'),
    path('disputes/<int:pk>/', views.DisputeDetailView.as_view(), name='dispute-detail'),

    # Project-specific payment actions
    path('projects/<int:project_id>/deposit/', views.deposit_funds, name='deposit-funds'),
    path('projects/<int:project_id>/milestones/<int:milestone_id>/release/',
         views.release_milestone_payment, name='release-payment'),

    # Dashboard data
    path('dashboard/', views.payment_dashboard, name='payment-dashboard'),
]