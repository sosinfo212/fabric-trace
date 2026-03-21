'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function WarehouseCard({
  onStructure,
  onView,
}: {
  onStructure: () => void;
  onView: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrepôt laboratoire</CardTitle>
        <CardDescription>Gérer la structure des racks et visualiser le stock.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onStructure}>
          Structure
        </Button>
        <Button type="button" onClick={onView}>
          Vue stock
        </Button>
      </CardContent>
    </Card>
  );
}
