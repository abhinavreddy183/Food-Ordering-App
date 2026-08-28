pipeline {
    agent any

    stages {

        stage('Install Dependencies') {
            steps {
                echo 'Installing Food Delivery App dependencies...'
                bat 'npm ci'
            }
        }

        stage('Syntax Check') {
            steps {
                echo 'Checking server.js syntax...'
                bat 'node --check server.js'
            }
        }

        stage('Build') {
            steps {
                echo 'Food Delivery App CI build completed successfully.'
            }
        }
    }

    post {
        success {
            echo 'Food Delivery App CI Pipeline: SUCCESS'
        }

        failure {
            echo 'Food Delivery App CI Pipeline: FAILED'
        }
    }
}
