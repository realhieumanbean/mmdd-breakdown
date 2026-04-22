"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { MoreVertical, Edit, Copy, Trash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ScriptDashboard() {
  const router = useRouter();
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // States for Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for Rename Modal
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [scriptToRename, setScriptToRename] = useState<any>(null);
  const [renamedTitle, setRenamedTitle] = useState("");

  useEffect(() => {
    fetchScripts();
  }, []);

  async function fetchScripts() {
    try {
      const { data, error } = await supabase
        .from("scripts")
        .select(`
          id,
          title,
          created_at,
          script_versions (id, version_name, created_at)
        `)
        .order('created_at', { ascending: false });

      if (error) setErrorMsg(error.message);
      else setScripts(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }

  // --- CRUD OPERATIONS ---

  async function handleCreateScript() {
    if (!newScriptTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from("scripts").insert([{ title: newScriptTitle }]).select().single();
      if (error) throw error;
      if (data) {
        await supabase.from("script_versions").insert([{ script_id: data.id, version_name: "V1" }]);
      }
      setNewScriptTitle("");
      setIsUploadModalOpen(false);
      await fetchScripts();
    } catch (error: any) {
      alert("Failed to create script: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteScript(scriptId: string) {
    // Basic confirmation dialog before permanent deletion
    const confirmed = window.confirm("Are you sure you want to delete this script? All associated versions, scenes, and breakdown elements will be permanently lost.");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("scripts").delete().eq("id", scriptId);
      if (error) throw error;
      await fetchScripts(); // Refresh UI
    } catch (error: any) {
      alert("Failed to delete script: " + error.message);
    }
  }

  async function handleDuplicateScript(script: any) {
    try {
      // 1. Create a copy of the main script
      const { data, error } = await supabase
        .from("scripts")
        .insert([{ title: `${script.title} (Copy)` }])
        .select()
        .single();
        
      if (error) throw error;

      // 2. Create a fresh V1 version for the copy
      if (data) {
        await supabase.from("script_versions").insert([{ script_id: data.id, version_name: "V1" }]);
      }
      await fetchScripts(); // Refresh UI
    } catch (error: any) {
      alert("Failed to duplicate script: " + error.message);
    }
  }

  function openRenameModal(script: any) {
    setScriptToRename(script);
    setRenamedTitle(script.title);
    setIsRenameModalOpen(true);
  }

  async function handleRenameSubmit() {
    if (!renamedTitle.trim() || !scriptToRename) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("scripts")
        .update({ title: renamedTitle })
        .eq("id", scriptToRename.id);
        
      if (error) throw error;
      
      setIsRenameModalOpen(false);
      await fetchScripts(); // Refresh UI
    } catch (error: any) {
      alert("Failed to rename script: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Script Management</h1>
            <p className="text-gray-500 mt-2">Manage feature film scripts, revisions, and breakdowns.</p>
          </div>

          {/* UPLOAD MODAL */}
          <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black text-white hover:bg-gray-800">
                + Upload New Script
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Script</DialogTitle>
                <DialogDescription>Enter the working title of the new feature film script.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input placeholder="e.g., Vientiane Shadows - Draft 2" value={newScriptTitle} onChange={(e) => setNewScriptTitle(e.target.value)} disabled={isSubmitting}/>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateScript} disabled={isSubmitting || !newScriptTitle.trim()}>
                  {isSubmitting ? "Creating..." : "Create Script"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* RENAME MODAL */}
        <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Script</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input value={renamedTitle} onChange={(e) => setRenamedTitle(e.target.value)} disabled={isSubmitting}/>
            </div>
            <DialogFooter>
              <Button onClick={handleRenameSubmit} disabled={isSubmitting || !renamedTitle.trim()}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {errorMsg && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg font-mono">
            <strong>Database Error:</strong> {errorMsg}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 font-medium animate-pulse">Loading production data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {scripts.map((script) => (
              <Card key={script.id} className="shadow-sm border-gray-200 relative group">
                
                {/* CARD HEADER WITH 3-DOTS MENU */}
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-xl pr-6">{script.title}</CardTitle>
                    <CardDescription>Master Document</CardDescription>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 absolute top-4 right-4 text-gray-400 hover:text-black">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => openRenameModal(script)} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateScript(script)} className="cursor-pointer">
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteScript(script.id)} className="cursor-pointer text-red-600 focus:text-red-600">
                        <Trash className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  <div className="text-sm font-medium text-gray-700">Versions & Revisions:</div>
                  <div className="flex flex-col gap-2">
                    {script.script_versions?.map((version: any) => (
                      <div key={version.id} className="flex justify-between items-center p-3 bg-gray-100 rounded-md">
                        <div className="flex items-center gap-3">
                          <Badge variant={version.version_name === 'V1' ? 'default' : 'secondary'}>
                            {version.version_name}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {new Date(version.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/breakdown/${version.id}`)}>
                          Open Breakdown
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}