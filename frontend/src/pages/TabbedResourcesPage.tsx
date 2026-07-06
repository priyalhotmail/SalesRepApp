import { Alert, Card, CardContent, Stack, Tab, Tabs } from "@mui/material";
import { useState } from "react";
import { ResourcePage } from "../components/ResourcePage";
import { ResourceRecord, resourceConfigs } from "../modules/resourceConfigs";

type TabbedResourcesPageProps = {
  tabs: { configKey: string; label: string }[];
  title: string;
};

export function TabbedResourcesPage({ tabs }: TabbedResourcesPageProps) {
  const [activeTab, setActiveTab] = useState(0);
  const active = tabs[activeTab] ?? tabs[0];
  const config = active ? resourceConfigs[active.configKey] : undefined;

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent sx={{ pb: 1 }}>
          <Tabs
            onChange={(_, value: number) => setActiveTab(value)}
            scrollButtons="auto"
            value={activeTab}
            variant="scrollable"
          >
            {tabs.map((tab) => (
              <Tab key={tab.configKey} label={tab.label} />
            ))}
          </Tabs>
        </CardContent>
      </Card>
      {config ? (
        <ResourcePage<ResourceRecord> config={config} />
      ) : (
        <Alert severity="error">Module configuration was not found.</Alert>
      )}
    </Stack>
  );
}
