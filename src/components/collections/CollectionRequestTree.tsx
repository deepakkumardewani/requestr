"use client";

import { Folder } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CollectionFolderModel, RequestModel } from "@/types";
import { RequestItem } from "./RequestItem";

type CollectionRequestTreeProps = {
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  activeRequestId: string | null;
};

type FolderNodeProps = {
  folder: CollectionFolderModel;
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  activeRequestId: string | null;
  depth: number;
};

function countDescendantRequests(
  folderId: string,
  folders: CollectionFolderModel[],
  requests: RequestModel[],
): number {
  const childFolderIds = folders
    .filter((child) => child.parentFolderId === folderId)
    .map((child) => child.id);

  const direct = requests.filter(
    (request) => request.folderId === folderId,
  ).length;
  const nested = childFolderIds.reduce(
    (sum, childId) => sum + countDescendantRequests(childId, folders, requests),
    0,
  );

  return direct + nested;
}

function FolderNode({
  folder,
  folders,
  requests,
  activeRequestId,
  depth,
}: FolderNodeProps) {
  const childFolders = folders
    .filter((child) => child.parentFolderId === folder.id)
    .sort((a, b) => a.order - b.order);
  const folderRequests = requests
    .filter((request) => request.folderId === folder.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <Accordion multiple defaultValue={[folder.id]} className="w-full">
      <AccordionItem value={folder.id} className="border-none">
        <AccordionTrigger
          chevronLeft
          className="py-1 hover:no-underline"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-foreground">
              {folder.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {countDescendantRequests(folder.id, folders, requests)}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <div className="space-y-0.5">
            {childFolders.map((child) => (
              <FolderNode
                key={child.id}
                folder={child}
                folders={folders}
                requests={requests}
                activeRequestId={activeRequestId}
                depth={depth + 1}
              />
            ))}
            {folderRequests.map((request) => (
              <div
                key={request.id}
                style={{ paddingLeft: `${(depth + 1) * 12}px` }}
              >
                <RequestItem
                  request={request}
                  isActive={activeRequestId === request.id}
                />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function CollectionRequestTree({
  folders,
  requests,
  activeRequestId,
}: CollectionRequestTreeProps) {
  const rootFolders = folders
    .filter((folder) => folder.parentFolderId === null)
    .sort((a, b) => a.order - b.order);
  const rootRequests = requests
    .filter((request) => !request.folderId)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (requests.length === 0) {
    return (
      <p className="py-1 text-center text-xs text-muted-foreground">
        No requests yet
      </p>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="space-y-0.5">
        {requests
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              isActive={activeRequestId === request.id}
            />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          folders={folders}
          requests={requests}
          activeRequestId={activeRequestId}
          depth={0}
        />
      ))}
      {rootRequests.map((request) => (
        <RequestItem
          key={request.id}
          request={request}
          isActive={activeRequestId === request.id}
        />
      ))}
    </div>
  );
}
