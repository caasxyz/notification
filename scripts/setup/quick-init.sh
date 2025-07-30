#!/bin/bash

echo "🚀 Quick Initialization for Notification System"
echo "=============================================="

# Simple setup without extensive checks
echo "📦 Installing dependencies..."
npm install || { echo "Failed to install dependencies"; exit 1; }

echo "📝 Creating environment file..."
if [ ! -f ".dev.vars" ]; then
    cat > .dev.vars << EOF
API_SECRET_KEY=test-secret-key-for-local-dev
ENCRYPT_KEY=test-encryption-key-32-characters
EOF
fi

echo "🗄️  Setting up database..."
# Create local database
mkdir -p .wrangler/state/v3/d1

echo ""
echo "✅ Basic setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "API will be available at:"
echo "  http://localhost:8788"
echo ""
echo "Test UI available at:"
echo "  http://localhost:8788/test-ui"