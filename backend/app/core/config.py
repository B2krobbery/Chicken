import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TheChickenMan B2B Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://visalvijay@localhost:5432/thechickenman")
    TEST_DATABASE_URL: str = os.getenv("TEST_DATABASE_URL", "postgresql://visalvijay@localhost:5432/thechickenman_test")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev_secret_key_thechickenman_b2b_poultry_platform_2026_super_secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # File Storage
    STORAGE_LOCAL_PATH: str = os.getenv("STORAGE_LOCAL_PATH", "./uploads")
    MAX_FILE_SIZE_MB: int = 10
    
    # External Providers
    PAYMENT_PROVIDER: str = os.getenv("PAYMENT_PROVIDER", "MOCK")
    PAYMENT_WEBHOOK_SECRET: str = os.getenv("PAYMENT_WEBHOOK_SECRET", "dev_webhook_secret_mock_gateway_9921")
    NOTIFICATION_PROVIDER: str = os.getenv("NOTIFICATION_PROVIDER", "MOCK")
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID", None)

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
