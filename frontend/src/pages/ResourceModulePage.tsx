import { Navigate, useParams } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import { resourceConfigs, ResourceRecord } from "../modules/resourceConfigs";

export function ResourceModulePage() {
  const { moduleKey } = useParams();
  const config = moduleKey ? resourceConfigs[moduleKey] : undefined;

  if (!config) {
    return <Navigate replace to="/" />;
  }

  return <ResourcePage<ResourceRecord> config={config} />;
}
