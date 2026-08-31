import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { hasAnyPermission } from "../auth/permissions";
import { AccessDenied } from "../components/AccessDenied";
import { ResourcePage } from "../components/ResourcePage";
import { resourceConfigs, ResourceRecord } from "../modules/resourceConfigs";

export function ResourceModulePage() {
  const { moduleKey } = useParams();
  const { user } = useAuth();
  const config = moduleKey ? resourceConfigs[moduleKey] : undefined;

  if (!config) {
    return <Navigate replace to="/" />;
  }

  if (!hasAnyPermission(user, config.requiredPermissions)) {
    return <AccessDenied />;
  }

  return <ResourcePage<ResourceRecord> config={config} />;
}
