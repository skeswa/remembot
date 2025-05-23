# Web Kubernetes Configuration

This directory contains Kubernetes manifests for deploying the Web frontend service.

## Files

- `deployment.yaml`: Defines the Deployment resource for running the Web containers
- `service.yaml`: Defines the Service resource for exposing the Web frontend

## Deployment

These manifests are automatically applied by the CI/CD pipeline when changes are merged to the main branch.

For manual deployment:

```bash
kubectl apply -f apps/web/k8s/
```

## Configuration

The deployment uses the following environment variables:

- `NODE_ENV`: Set to "production" in the deployment
- Other configuration variables specific to the web app

Additional configuration can be added to the `deployment.yaml` file as needed.
