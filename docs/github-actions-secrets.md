# GitHub Actions Secrets

This document outlines all the secrets required for GitHub Actions workflows in this repository.

## Deployment Secrets

### Kubeconfig Secrets

These secrets contain the kubeconfig files for different deployment targets. The secret names are constructed using the format `{TARGET}_KUBECONFIG` where `{TARGET}` is the deployment target name in uppercase.

| Secret Name           | Description                                 | Required For                |
| --------------------- | ------------------------------------------- | --------------------------- |
| `RHUIDEAN_KUBECONFIG` | Kubeconfig for the rhuidean (Ubuntu) server | courier app deployment      |
| `HOMEMAC_KUBECONFIG`  | Kubeconfig for the homemac (macOS) server   | web and api apps deployment |

### Container Registry Secrets

| Secret Name    | Description                              | Required For                      |
| -------------- | ---------------------------------------- | --------------------------------- |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions | Container registry authentication |

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

### Kubeconfig Setup

For each deployment target:

1. Get the kubeconfig file from your k3s cluster:

   ```bash
   # On the target server
   cat /etc/rancher/k3s/k3s.yaml
   ```

2. Create a new secret in GitHub:
   - Name: `{TARGET}_KUBECONFIG` (e.g., `RHUIDEAN_KUBECONFIG`)
   - Value: Paste the entire contents of the kubeconfig file

## Relationship with target.yaml

Each app in the monorepo has a `k8s/target.yaml` file that specifies which deployment target it should be deployed to. The workflow uses this file to determine which kubeconfig secret to use:

1. The `target.yaml` file contains a single line with the target name (e.g., `rhuidean` or `homemac`)
2. During deployment, the workflow:
   - Reads the target from `apps/{app}/k8s/target.yaml`
   - Converts the target name to uppercase
   - Uses it to construct the secret name: `{TARGET}_KUBECONFIG`
   - Uses the corresponding secret for deployment

For example:

- If `apps/courier/k8s/target.yaml` contains `rhuidean`, the workflow will use `RHUIDEAN_KUBECONFIG`
- If `apps/web/k8s/target.yaml` contains `homemac`, the workflow will use `HOMEMAC_KUBECONFIG`

## Security Notes

- Never commit kubeconfig files to the repository
- Rotate kubeconfig files periodically
- Use the minimum required permissions in the kubeconfig files
- Consider using service accounts with limited permissions instead of admin credentials

## Troubleshooting

If deployments fail due to secret-related issues:

1. Verify the secret exists in GitHub repository settings
2. Check that the secret name matches exactly (case-sensitive)
3. Ensure the kubeconfig file is valid and has the correct permissions
4. Verify the kubeconfig has access to the correct namespace
5. Confirm that the target name in `target.yaml` matches the expected deployment target
