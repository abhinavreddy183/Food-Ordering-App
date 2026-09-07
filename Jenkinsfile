pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo '=== Checking out Food Delivery App source code ==='
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '=== Installing Node.js dependencies ==='
                bat 'npm ci'
            }
        }

        stage('Syntax Check') {
            steps {
                echo '=== Checking server.js syntax ==='
                bat 'node --check server.js'
            }
        }

        stage('Docker Build') {
            steps {
                echo '=== Building Food Delivery App Docker image ==='
                bat 'docker build -t foodflow-web:%BUILD_NUMBER% .'
            }
        }

        stage('Deploy') {
            steps {
                echo '=== Deploying Food Delivery App using Docker Compose ==='
                bat 'if not exist .env copy .env.example .env'
                bat 'docker compose down --remove-orphans'
                bat 'docker compose up -d'
            }
        }

        stage('Application Verification') {
            steps {
                echo '=== Verifying Docker containers ==='
                bat 'docker compose ps'
            }
        }
    }

    post {
        success {
            echo '=== Food Delivery App CI/CD Pipeline SUCCESS ==='
        }

        failure {
            echo '=== Food Delivery App CI/CD Pipeline FAILED ==='
        }

        always {
            echo '=== Jenkins pipeline execution completed ==='
        }
    }
}