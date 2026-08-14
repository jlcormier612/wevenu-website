export type VendorTaskTemplateAttachment = {
  id:          string;
  itemId:      string;
  name:        string;
  storagePath: string;
  storageUrl:  string;
  mimeType:    string | null;
  fileSize:    number | null;
  sortOrder:   number;
};

export type VendorTaskTemplateItem = {
  id:          string;
  templateId:  string;
  title:       string;
  daysOffset:  number | null;
  notes:       string | null;
  /** Copied to vendor_tasks.action_type on apply. */
  actionType:  "share_timeline" | null;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
  attachments: VendorTaskTemplateAttachment[];
};

/** Named pack (e.g. "Gold package") containing multiple template items. */
export type VendorTaskTemplate = {
  id:          string;
  vendorId:    string;
  name:        string;
  notes:       string | null;
  packageId:   string | null;
  eventType:   string | null;
  isActive:    boolean;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
  /** Joined package name when loaded with packages. */
  packageName?: string | null;
  items:       VendorTaskTemplateItem[];
};

export type VendorTaskTemplatePackInput = {
  name:      string;
  notes:     string;
  packageId: string;
  eventType: string;
  isActive:  boolean;
};

export type VendorTaskTemplateItemInput = {
  title:      string;
  daysOffset: string;
  notes:      string;
  actionType?: "share_timeline" | "" | null;
};

export type VendorTaskAttachment = {
  id:          string;
  vendorTaskId: string;
  name:        string;
  storagePath: string;
  storageUrl:  string;
  mimeType:    string | null;
  fileSize:    number | null;
  sortOrder:   number;
};

/** @deprecated Use VendorTaskTemplatePackInput */
export type VendorTaskTemplateInput = VendorTaskTemplatePackInput & {
  title?: string;
  daysOffset?: string;
};
