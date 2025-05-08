# API Kubernetes Configuration

This directory contains Kubernetes manifests for deploying the API service.

## Files

- `deployment.yaml`: Defines the Deployment resource for running the API containers
- `service.yaml`: Defines the Service resource for exposing the API within the cluster

## Deployment

These manifests are automatically applied by the CI/CD pipeline when changes are merged to the main branch.

For manual deployment:

```bash
kubectl apply -f apps/api/k8s/
```

## Configuration

The deployment uses the following environment variables:

- `NODE_ENV`: Set to "production" in the deployment
- `COURIER_URL`: URL to the courier service

Additional configuration can be added to the `deployment.yaml` file as needed. 