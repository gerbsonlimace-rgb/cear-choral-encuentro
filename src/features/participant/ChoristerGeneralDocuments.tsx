import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ChoristerPortalFeed } from "@/features/chorister-app/choristerApp.domain";
import {
  getParticipantEventDocumentUrl,
  getParticipantGeneralDocuments,
} from "@/lib/event-document.functions";

import { ChoristerScoresTab, type PdfAsset } from "./ChoristerScoresTab";

type Documents = ChoristerPortalFeed["event"]["documents"];

export function ChoristerGeneralDocuments({
  loadDocuments = getParticipantGeneralDocuments,
  getDocumentUrl = getParticipantEventDocumentUrl,
  showEmpty = true,
}: {
  loadDocuments?: () => Promise<Documents>;
  getDocumentUrl?: (input: {
    data: { id: string };
  }) => Promise<{ signedUrl: string; expiresIn: number }>;
  showEmpty?: boolean;
}) {
  const [documents, setDocuments] = useState<Documents>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void loadDocuments()
      .then((loaded) => {
        if (!active) return;
        setDocuments(loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [loadDocuments, attempt]);

  async function renew(asset: PdfAsset): Promise<PdfAsset> {
    const { signedUrl, expiresIn } = await getDocumentUrl({ data: { id: asset.id } });
    return {
      ...asset,
      signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  if (status === "loading")
    return (
      <p role="status" className="text-sm text-zinc-600">
        Carregando documentos…
      </p>
    );
  if (status === "error")
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar os documentos.
        </p>
        <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          Tentar novamente
        </Button>
      </div>
    );
  if (documents.length === 0)
    return showEmpty ? (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
        Nenhum documento geral foi publicado ainda.
      </p>
    ) : null;

  return (
    <ChoristerScoresTab
      documents={documents}
      headingId="general-documents"
      showSongScores={false}
      onOpen={renew}
      onDownload={renew}
    />
  );
}
