FROM python:3.12-slim

# Install system dependencies required for compiling dlib (face_recognition)
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for blazing fast dependency management
RUN pip install uv

WORKDIR /app

# Copy the dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen

# Copy the rest of the application
COPY . .

# Expose the backend port
EXPOSE 8080

# Run the app through uv
CMD ["uv", "run", "python", "main.py"]
