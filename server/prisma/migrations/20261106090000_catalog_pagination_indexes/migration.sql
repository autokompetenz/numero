-- Index de pagination du catalogue : les filtres publics portent sur le pays,
-- le service et le type, toujours avec les offres actives en stock.

CREATE INDEX "CatalogItem_countryCode_enabled_availableCount_idx"
  ON "CatalogItem" ("countryCode", "enabled", "availableCount");

CREATE INDEX "CatalogItem_serviceId_enabled_availableCount_idx"
  ON "CatalogItem" ("serviceId", "enabled", "availableCount");

CREATE INDEX "CatalogItem_type_enabled_availableCount_idx"
  ON "CatalogItem" ("type", "enabled", "availableCount");
