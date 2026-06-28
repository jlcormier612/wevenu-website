"use client";

import * as React from "react";

import { Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { sendMessageAction } from "@/app/(app)/messaging/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/integrations/supabase/client";
import type { ComposeInput, MessageEntityType, SendResult } from "@/lib/messaging/types";

type PendingAttachment = { file: File; storagePath: string; storageUrl: string; uploaded: boolean };

export function MessageCompose({
  entityType,
  entityId,
  defaultToEmail,
  defaultToName,
  prefillSubject,
  prefillBody,
  luvDraftId,
  onSent,
  onCancel,
}: {
  entityType: MessageEntityType;
  entityId: string;
  defaultToEmail: string;
  defaultToName: string;
  prefillSubject?: string;
  prefillBody?: string;
  luvDraftId?: string;
  onSent: (result: SendResult) => void;
  onCancel?: () => void;
}) {
  const [toEmail, setToEmail] = React.useState(defaultToEmail);
  const [subject, setSubject] = React.useState(prefillSubject ?? "");
  const [body, setBody] = React.useState(prefillBody ?? "");
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [pending, startSend] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Sync prefill when it changes (Luv bridge)
  React.useEffect(() => { if (prefillSubject !== undefined) setSubject(prefillSubject); }, [prefillSubject]);
  React.useEffect(() => { if (prefillBody !== undefined) setBody(prefillBody); }, [prefillBody]);

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.size > 25 * 1024 * 1024) { toast.error("Max file size 25 MB."); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `messages/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      setAttachments((p) => [...p, { file, storagePath: path, storageUrl: urlData.publicUrl, uploaded: true }]);
    } catch { toast.error("File upload failed."); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSend() {
    if (!toEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    startSend(async () => {
      const input: ComposeInput = {
        toEmail: toEmail.trim(), toName: defaultToName, subject: subject.trim(), body: body.trim(), luvDraftId,
        attachments: attachments.filter((a) => a.uploaded).map((a) => ({
          name: a.file.name, storagePath: a.storagePath, storageUrl: a.storageUrl,
          mimeType: a.file.type, fileSize: a.file.size,
        })),
      };
      const result = await sendMessageAction(entityType, entityId, input);
      if (result.ok) {
        toast.success(`Message sent to ${toEmail}.`);
        onSent(result);
      } else {
        toast.error(result.message ?? "Could not send message.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-heading">New message</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground w-10">To</span>
          <input
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="recipient@email.com"
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm border-b border-border pb-2">
          <span className="text-xs font-medium text-muted-foreground w-10">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your message…"
        rows={8}
        className="font-sans text-sm leading-relaxed resize-none border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus={!prefillBody}
      />

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground truncate max-w-32">{a.file.name}</span>
              <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            disabled={uploading}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            <span>Attach</span>
          </button>
          <input ref={fileRef} type="file" className="sr-only" onChange={handleAttachFile} />
        </div>
        <Button type="button" size="sm" onClick={handleSend} disabled={pending || uploading || !toEmail || !subject || !body}>
          {pending
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
            : <><Send className="mr-1.5 h-3.5 w-3.5" />Send</>}
        </Button>
      </div>
    </div>
  );
}
