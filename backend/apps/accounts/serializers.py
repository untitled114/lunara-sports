"""
Serializers for Lunara user account management.
Handles user registration, authentication, and profile management.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Profile, EmailVerification


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration with profile creation."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    name = serializers.CharField(write_only=True, required=False)  # Accept 'name' field from frontend

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'user_type', 'first_name', 'last_name', 'name')
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match.")
        return attrs

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def create(self, validated_data):
        validated_data.pop('password_confirm')

        # Handle 'name' field by splitting into first_name/last_name
        name = validated_data.pop('name', None)
        if name:
            name_parts = name.split(' ', 1)
            validated_data['first_name'] = name_parts[0]
            validated_data['last_name'] = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(**validated_data)

        # Create associated profile
        Profile.objects.create(user=user)
        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user authentication."""

    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials.')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled.')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Email and password required.')

        return attrs


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile management."""

    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_type = serializers.CharField(source='user.user_type', read_only=True)

    class Meta:
        model = Profile
        fields = (
            'bio', 'avatar', 'skills', 'hourly_rate', 'portfolio_url',
            'phone', 'timezone', 'is_profile_complete', 'average_rating',
            'total_projects', 'user_email', 'user_type', 'created_at'
        )
        read_only_fields = ('is_profile_complete', 'average_rating', 'total_projects', 'created_at')


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user information with profile data."""

    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'user_type', 'is_verified', 'profile')
        read_only_fields = ('id', 'email', 'is_verified')


class TokenSerializer(serializers.Serializer):
    """Serializer for JWT token responses."""

    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class EmailCheckSerializer(serializers.Serializer):
    """Serializer for checking email availability."""

    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()


class UsernameCheckSerializer(serializers.Serializer):
    """Serializer for checking username availability."""

    username = serializers.CharField(max_length=150)