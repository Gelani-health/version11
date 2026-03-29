# Gelani Healthcare Platform - Compressed Context

## Repository Information
- **GitHub**: https://github.com/Gelani-health/version11.git
- **Token**: <REDACTED>
- **Local Path**: `/home/z/my-project/version11`
- **Branch**: main

## Architecture Overview
- **Framework**: Next.js 16 with React 19
- **Database**: Prisma ORM with SQLite
- **Authentication**: Custom auth-middleware with RBAC
- **Microservices**: FastAPI Python services on ports 3031, 3032, 3033
- **Main App**: Port 3000

## Roles & Permissions (Just Implemented)

### Roles
| Role | Lab Permissions | Imaging Permissions |
|------|-----------------|---------------------|
| doctor | read, write, verify | read, write |
| nurse | read | read |
| admin | all | all |
| specialist | read, write, verify | read, write |
| pharmacist | read | read |
| receptionist | read | read |
| **radiologist** | read | read, write, interpret, approve |
| **lab_worker** | read, write, result_entry, verify | read |

### Key Permission Types
- **Lab**: `lab:read`, `lab:write`, `lab:result_entry`, `lab:verify`, `lab:approve`
- **Imaging**: `imaging:read`, `imaging:write`, `imaging:perform`, `imaging:interpret`, `imaging:approve`

## Key Files Modified (Commit a7f3869)
1. `src/lib/rbac-middleware.ts` - RBAC core logic
2. `src/lib/auth-middleware.ts` - Authentication middleware
3. `src/app/api/lab-orders/route.ts` - Lab orders API (auth enabled)
4. `src/app/api/lab-results/route.ts` - Lab results API (auth + critical values)
5. `src/components/role-based-access-control.tsx` - RBAC UI component

## Pending Work (Not Started)
- Apply authentication to remaining API routes (only lab-orders, lab-results, patients done)
- Implement imaging API authentication
- Apply role-based UI visibility in components

## Quick Commands
```bash
# Run app
cd /home/z/my-project/version11 && npm run dev

# Git operations
GIT_DIR=/home/z/my-project/version11/.git GIT_WORK_TREE=/home/z/my-project/version11 git status
GIT_DIR=/home/z/my-project/version11/.git GIT_WORK_TREE=/home/z/my-project/version11 git push https://<TOKEN>@github.com/Gelani-health/version11.git main

# TypeScript check
cd /home/z/my-project/version11 && npx tsc --noEmit
```

## Environment Constraints
- Containerized environment (LifseaOS/Kata Containers)
- Background processes don't persist
- Use Docker for persistent services
