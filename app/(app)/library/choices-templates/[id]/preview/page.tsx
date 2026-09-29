import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTemplate } from "@/lib/client-choices-templates/service";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview · ${template.name}` : "Choices template" };
}

export default async function ChoicesTemplatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/library/choices-templates" className="text-xs text-muted-foreground hover:underline">
          ← Choices Templates
        </Link>
        <PageHeader
          title={template.name}
          description="Preview of this Choices template. Use Template on the Library list to create client choices for an event."
          actions={
            <Button variant="outline" render={<Link href={`/library/choices-templates/${template.id}`} />}>
              Edit
            </Button>
          }
        />
      </div>
      <LibraryDependencyNote
        detail="When you edit this template, you can attach offerings as options (or write custom labels)."
        action={{ href: "/library/offerings", label: "Manage Offerings" }}
      >
        Options can use offerings from your Offerings catalog.
      </LibraryDependencyNote>
      {template.description ? (
        <p className="text-sm text-muted-foreground">{template.description}</p>
      ) : null}
      <div className="space-y-4">
        {template.sections.length === 0 && template.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sections or groups yet.</p>
        ) : null}
        {template.sections.map((section) => {
          const groups = template.groups.filter((g) => g.sectionId === section.id);
          return (
            <section key={section.id} className="space-y-2 rounded-sm border border-border p-4">
              <h2 className="text-sm font-semibold text-heading">{section.name}</h2>
              {groups.map((g) => (
                <div key={g.id} className="space-y-1 pl-2">
                  <p className="text-sm font-medium text-heading">
                    {g.name}{" "}
                    <Badge variant="outline" className="text-[10px]">{g.selectionMode}</Badge>
                  </p>
                  <ul className="space-y-0.5 text-sm text-muted-foreground">
                    {template.options.filter((o) => o.groupId === g.id).map((o) => (
                      <li key={o.id}>
                        {o.label}
                        {o.isIncluded ? " · included" : o.unitPrice != null ? ` · $${o.unitPrice}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
        {template.groups.filter((g) => !g.sectionId).map((g) => (
          <section key={g.id} className="space-y-2 rounded-sm border border-border p-4">
            <p className="text-sm font-medium text-heading">{g.name}</p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {template.options.filter((o) => o.groupId === g.id).map((o) => (
                <li key={o.id}>{o.label}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
