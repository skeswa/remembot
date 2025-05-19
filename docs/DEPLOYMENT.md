# Deployment Guide

## Prerequisites

- k3s cluster
- Docker registry access
- Cloud provider credentials
- SSL certificates
- Domain name

## Infrastructure Setup

### 1. k3s Cluster

1. Install k3s on your server:
```bash
curl -sfL https://get.k3s.io | sh -
```

2. Configure kubectl:
```bash
# Copy kubeconfig
sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/config
chmod 600 ~/.kube/config

# Set KUBECONFIG environment variable
export KUBECONFIG=~/.kube/config
```

### 2. Database Setup

1. Deploy PostgreSQL using Helm:
```bash
# Add Bitnami Helm repo
helm repo add bitnami https://charts.bitnami.com/bitnami

# Install PostgreSQL
helm install postgres bitnami/postgresql \
  --set auth.database=remembot \
  --set auth.username=remembot \
  --set auth.password=your-secure-password
```

2. Get database credentials:
```bash
export POSTGRES_PASSWORD=$(kubectl get secret postgres-postgresql -o jsonpath="{.data.postgres-password}" | base64 --decode)
```

### 3. Redis Setup

1. Deploy Redis using Helm:
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install redis bitnami/redis
```

## Deployment Process

### 1. Build Docker Images

```bash
# Build the application image
docker build -t remembot:latest .

# Push to registry
docker tag remembot:latest your-registry/remembot:latest
docker push your-registry/remembot:latest
```

### 2. Deploy to k3s

1. Create namespace:
```bash
kubectl create namespace remembot
```

2. Apply configurations:
```bash
# Apply secrets
kubectl apply -f k8s/secrets.yaml

# Apply configmaps
kubectl apply -f k8s/configmaps.yaml

# Apply deployments
kubectl apply -f k8s/deployments.yaml

# Apply services
kubectl apply -f k8s/services.yaml
```

### 3. Configure Ingress

1. Set up SSL certificate:
```bash
kubectl apply -f k8s/certificate.yaml
```

2. Configure ingress:
```bash
kubectl apply -f k8s/ingress.yaml
```

## Monitoring Setup

### 1. Prometheus

```bash
# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack
```

### 2. Grafana

```bash
# Install Grafana
helm install grafana grafana/grafana
```

## Backup and Recovery

### Database Backups

1. Configure automated backups:
```bash
# Create backup cronjob
kubectl apply -f k8s/backup-cronjob.yaml
```

2. Manual backup:
```bash
# Create backup
kubectl exec -it postgres-postgresql-0 -- pg_dump -U remembot remembot > backup.sql
```

### Recovery Process

1. Restore from backup:
```bash
# Copy backup to pod
kubectl cp backup.sql postgres-postgresql-0:/tmp/

# Restore database
kubectl exec -it postgres-postgresql-0 -- psql -U remembot remembot -f /tmp/backup.sql
```

## Scaling

### Horizontal Pod Autoscaling

```bash
kubectl apply -f k8s/hpa.yaml
```

### Database Scaling

1. Vertical scaling:
```bash
# Update PostgreSQL resources
helm upgrade postgres bitnami/postgresql \
  --set resources.requests.memory=2Gi \
  --set resources.requests.cpu=1
```

2. Read replicas:
```bash
# Add read replicas
helm upgrade postgres bitnami/postgresql \
  --set readReplicas.replicaCount=2
```

## Security

### Network Policies

```bash
kubectl apply -f k8s/network-policies.yaml
```

### Secret Management

1. Store secrets in Kubernetes:
```bash
kubectl create secret generic app-secrets \
  --from-literal=DB_PASSWORD=your-password \
  --from-literal=API_KEY=your-key
```

2. Use external secret management:
```bash
# Install external-secrets operator
helm install external-secrets external-secrets/external-secrets
```

## Maintenance

### Updates

1. Update application:
```bash
kubectl set image deployment/remembot \
  remembot=your-registry/remembot:new-version
```

2. Database migrations:
```bash
kubectl apply -f k8s/migrations.yaml
```

### Monitoring

1. Check application health:
```bash
kubectl get pods -n remembot
kubectl logs -f deployment/remembot
```

2. Monitor resources:
```bash
kubectl top pods -n remembot
kubectl top nodes
```

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**
   - Check pod logs
   - Verify environment variables
   - Check resource limits

2. **Database Connection Issues**
   - Verify network policies
   - Check credentials
   - Test connection from pod

3. **Ingress Issues**
   - Verify SSL certificate
   - Check ingress configuration
   - Test DNS resolution

## Rollback Procedures

1. Rollback deployment:
```bash
kubectl rollout undo deployment/remembot
```

2. Restore database:
```bash
# Copy backup to pod
kubectl cp backup.sql postgres-postgresql-0:/tmp/

# Restore database
kubectl exec -it postgres-postgresql-0 -- psql -U remembot remembot -f /tmp/backup.sql
``` 