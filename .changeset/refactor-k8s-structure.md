---
"api": patch
"web": patch
"courier": patch
---

Refactor Kubernetes manifests structure to colocate k8s files with each app instead of a centralized k8s directory. This improves organization by keeping application code and its deployment configuration together. 