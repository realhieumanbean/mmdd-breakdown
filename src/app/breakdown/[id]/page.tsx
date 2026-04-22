"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as mammoth from "mammoth/mammoth.browser";
import { 
  ArrowLeft, Plus, Film, Box, Users, MoreVertical, Edit, Trash, 
  Upload, Lock, Unlock, Save, Table, FileText, ExternalLink, Activity, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BreakdownPage() {
  const params = useParams();
  const router = useRouter();
  const versionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [scriptId, setScriptId] = useState<string | null>(null);
  
  // Progress & Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  
  const [scenes, setScenes] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  
  // States for NEW Elements
  const [newElementName, setNewElementName] = useState("");
  const [newElementCategory, setNewElementCategory] = useState("Prop");
  
  // States for SEARCH & FILTER
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // States for EDIT Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Scene Edit States
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editSynopsis, setEditSynopsis] = useState("");

  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBreakdownData();
  }, [versionId]);

  async function fetchBreakdownData() {
    try {
      const { data: versionData } = await supabase.from("script_versions").select("script_id").eq("id", versionId).single();
      if (versionData) setScriptId(versionData.script_id);

      let sceneIds: string[] = [];

      // 1. Tải danh sách Cảnh quay
      if (versionData?.script_id) {
        const { data: sceneData } = await supabase.from("scenes").select("*").eq("script_id", versionData.script_id);
        if (sceneData) {
          const sorted = [...sceneData].sort((a, b) => 
            a.scene_number.localeCompare(b.scene_number, undefined, { numeric: true, sensitivity: 'base' })
          );
          setScenes(sorted);
          sceneIds = sorted.map(s => s.id);
        }
      }

      // 2. Tính toán Mật độ xuất hiện (Frequency)
      const frequencyMap: Record<string, number> = {};
      if (sceneIds.length > 0) {
        const { data: seData } = await supabase.from("scene_elements").select("element_id").in("scene_id", sceneIds);
        if (seData) {
          seData.forEach(se => {
            frequencyMap[se.element_id] = (frequencyMap[se.element_id] || 0) + 1;
          });
        }
      }

      // 3. Tải Elements và Sắp xếp
      const { data: elementData } = await supabase.from("elements").select("*");
      if (elementData) {
        const elementsWithCount = elementData.map(el => ({
          ...el,
          count: frequencyMap[el.id] || 0
        })).sort((a, b) => b.count - a.count); 
        
        setElements(elementsWithCount);
      }

    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  }

  // --- LOGIC LỌC & TÌM KIẾM ---
  const displayedElements = elements.filter(el => {
    const matchCat = categoryFilter === "All" || el.category === categoryFilter;
    const matchName = el.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchName;
  });

  // --- 1. XỬ LÝ UPLOAD KỊCH BẢN ---
  async function handleScriptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !scriptId) return;

    setIsUploading(true); setUploadProgress(0); setUploadStatusText("Đang đọc file kịch bản...");

    try {
      let text = "";
      if (file.name.endsWith(".docx")) {
         const arrayBuffer = await file.arrayBuffer();
         const result = await mammoth.extractRawText({ arrayBuffer });
         text = result.value;
      } else if (file.name.endsWith(".txt")) {
         text = await file.text();
      } else {
         alert("Vui lòng tải lên file .txt hoặc .docx"); setIsUploading(false); return;
      }

      setUploadStatusText("Đang bóc tách phân cảnh...");
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let parsedScenes: any[] = [];
      let currentScene: any = null;

      const sceneRegex = /^\s*(\d+)\s*[\.\-\:\)]?\s*(?:(?:MONTAGE|FLASHBACK|FLASHCUT)\s*[\.\-\:]?\s*)?(NỘI|NGOẠI|NỘI\/NGOẠI|INTERCUT|MONTAGE|FLASHBACK|FLASHCUT)(.*)$/i;

      for (const line of lines) {
        const sceneMatch = line.match(sceneRegex);
        if (sceneMatch) {
          if (currentScene) parsedScenes.push(currentScene);
          const explicitNumber = sceneMatch[1]; 
          const headingType = sceneMatch[2].toUpperCase();
          const restOfHeading = sceneMatch[3].toUpperCase();
          let dayNight = "DAY";
          if (restOfHeading.includes("ĐÊM") || restOfHeading.includes("TỐI")) dayNight = "NIGHT";
          else if (restOfHeading.includes("CHIỀU") || restOfHeading.includes("HOÀNG HÔN")) dayNight = "AFTERNOON";

          currentScene = { script_id: scriptId, scene_number: explicitNumber, int_ext: headingType, day_night: dayNight, synopsis: line + "\n" };
        } else if (currentScene) {
          currentScene.synopsis += line + "\n";
        }
      }
      if (currentScene) parsedScenes.push(currentScene);

      setUploadStatusText("Đang dọn dẹp dữ liệu cũ...");
      await supabase.from("scenes").delete().eq("script_id", scriptId);

      setUploadStatusText("Đang lưu vào cơ sở dữ liệu...");
      const batchSize = 5;
      for (let i = 0; i < parsedScenes.length; i += batchSize) {
        const batch = parsedScenes.slice(i, i + batchSize);
        await supabase.from("scenes").insert(batch);
        setUploadProgress(Math.round((Math.min(i + batchSize, parsedScenes.length) / parsedScenes.length) * 100));
      }

      setUploadStatusText("Hoàn tất!");
      await fetchBreakdownData();
    } catch (err: any) {
      alert("Lỗi đọc file: " + err.message);
    } finally {
      setTimeout(() => setIsUploading(false), 1000);
      if (scriptInputRef.current) scriptInputRef.current.value = "";
    }
  }

  // --- 2. XỬ LÝ IMPORT BREAKDOWN (CSV) ---
  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !scriptId) return;

    setIsUploading(true); setUploadProgress(0); setUploadStatusText("Đang đọc file CSV...");

    try {
      const text = await file.text();
      const rows = text.split('\n').slice(1).filter(r => r.trim().length > 0); 
      const totalRows = rows.length;

      setUploadStatusText("Đang map dữ liệu với Cảnh quay...");
      for (let i = 0; i < totalRows; i++) {
        const [sceneNo, category, name] = rows[i].split(',').map(item => item?.trim());
        if (!name || !category) continue;

        const { data: existingEl } = await supabase.from("elements").select("id").eq("name", name).eq("category", category).single();
        let elementId = existingEl?.id;

        if (!elementId) {
          const { data: newEl } = await supabase.from("elements").insert([{ name, category, status: 'Pending' }]).select().single();
          elementId = newEl?.id;
        }

        const { data: targetScene } = await supabase.from("scenes").select("id").eq("script_id", scriptId).eq("scene_number", sceneNo).single();
        if (targetScene && elementId) {
          await supabase.from("scene_elements").insert([{ scene_id: targetScene.id, element_id: elementId }]);
        }
        
        setUploadProgress(Math.round(((i + 1) / totalRows) * 100));
      }

      setUploadStatusText("Hoàn tất nhập liệu!");
      await fetchBreakdownData();
    } catch (err: any) {
      alert("Lỗi nhập file CSV: " + err.message);
    } finally {
      setTimeout(() => setIsUploading(false), 1000);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  // --- CRUD FUNCTIONS ---
  async function handleSaveScene(sceneId: string) {
    await supabase.from("scenes").update({ synopsis: editSynopsis }).eq("id", sceneId);
    setEditingSceneId(null); await fetchBreakdownData();
  }
  async function handleAddElement() {
    if (!newElementName.trim()) return;
    await supabase.from("elements").insert([{ name: newElementName, category: newElementCategory, status: 'Pending' }]);
    setNewElementName(""); await fetchBreakdownData();
  }
  async function handleDeleteElement(id: string) {
    if (window.confirm("Xóa hạng mục này?")) {
      await supabase.from("elements").delete().eq("id", id); await fetchBreakdownData();
    }
  }
  async function handleEditSubmit() {
    await supabase.from("elements").update({ name: editName, category: editCategory, status: editStatus }).eq("id", editingElement.id);
    setIsEditModalOpen(false); await fetchBreakdownData();
  }

  function getCategoryIcon(cat: string) {
    if (cat === 'Set') return <Film className="w-4 h-4 text-blue-500" />;
    if (cat === 'Prop') return <Box className="w-4 h-4 text-orange-500" />;
    return <Users className="w-4 h-4 text-purple-500" />;
  }

  if (loading) return <div className="p-10 text-center">Đang tải dữ liệu sản xuất...</div>;

  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden">
      
      {/* HEADER CÓ THANH TIẾN TRÌNH */}
      <header className="border-b bg-gray-50/50 shrink-0">
        <div className="h-14 flex items-center px-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}><ArrowLeft className="w-4 h-4 mr-2" /> Dashboard</Button>
            <div className="h-4 w-px bg-gray-300"></div>
            <span className="font-semibold text-sm">Phòng Làm Việc Bóc Tách</span>
            <Badge variant="secondary" className="font-mono text-xs">{versionId}</Badge>
          </div>
          <div className="flex gap-2">
            <input type="file" accept=".docx,.txt" ref={scriptInputRef} onChange={handleScriptUpload} className="hidden" />
            <input type="file" accept=".csv" ref={csvInputRef} onChange={handleCSVUpload} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => scriptInputRef.current?.click()} disabled={isUploading}>
              <FileText className="w-4 h-4 mr-2" /> Nhập Kịch Bản (.txt)
            </Button>
            <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} disabled={isUploading}>
              <Table className="w-4 h-4 mr-2" /> Nhập Breakdown (CSV)
            </Button>
          </div>
        </div>
        
        {isUploading && (
          <div className="w-full bg-blue-50 border-t border-blue-100 flex items-center px-4 py-2 text-xs text-blue-700">
            <Activity className="w-3 h-3 mr-2 animate-spin" />
            <span className="flex-1 font-medium">{uploadStatusText}</span>
            <span className="font-mono ml-4">{uploadProgress}%</span>
            <div className="w-48 h-1.5 ml-2 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        
        {/* BẢNG TRÁI: KỊCH BẢN */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <ScrollArea className="h-full">
            <div className="p-8 max-w-2xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold border-b pb-4">Nội Dung Phân Cảnh (Tổng: {scenes.length})</h2>
              {scenes.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-xl text-gray-400">Hãy nhập file kịch bản .txt hoặc .docx để bắt đầu</div>
              ) : (
                scenes.map((scene) => (
                  <div key={scene.id} className="p-5 bg-gray-50 rounded-xl border border-gray-200 shadow-sm relative group">
                    <div className="flex font-bold text-gray-900 gap-2 mb-3 items-center border-b pb-2">
                      <span className="bg-black text-white px-2 py-0.5 rounded text-xs">{scene.scene_number}</span>
                      <span>{scene.int_ext}</span>
                      <span className="flex-1"></span>
                      <span>{scene.day_night}</span>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (editingSceneId === scene.id) handleSaveScene(scene.id);
                        else { setEditingSceneId(scene.id); setEditSynopsis(scene.synopsis); }
                      }}>
                        {editingSceneId === scene.id ? <Save className="w-3 h-3" /> : <Lock className="w-3 h-3 text-gray-300" />}
                      </Button>
                    </div>
                    {editingSceneId === scene.id ? (
                      <textarea value={editSynopsis} onChange={(e) => setEditSynopsis(e.target.value)} className="w-full min-h-[100px] p-2 text-sm border rounded" />
                    ) : (
                      <p className="text-gray-700 text-sm whitespace-pre-wrap font-serif leading-relaxed">{scene.synopsis}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-gray-200 w-1.5" />

        {/* BẢNG PHẢI: QUẢN LÝ ĐẠO CỤ */}
        <ResizablePanel defaultSize={50} minSize={30} className="bg-gray-50 flex flex-col">
          
          {/* KHU VỰC 1: ADD FORM */}
          <div className="p-4 bg-white border-b border-gray-200 shadow-sm shrink-0">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Thêm Nhanh Hạng Mục</h3>
            <div className="flex gap-2">
              <Select value={newElementCategory} onValueChange={setNewElementCategory}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Set">Bối Cảnh</SelectItem>
                  <SelectItem value="Prop">Đạo Cụ</SelectItem>
                  <SelectItem value="Character">Nhân Vật</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Nhập tên mới..." value={newElementName} onChange={(e) => setNewElementName(e.target.value)} className="flex-1" />
              <Button onClick={handleAddElement} className="bg-black text-white"><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          {/* KHU VỰC 2: THANH CÔNG CỤ TÌM KIẾM VÀ LỌC */}
          <div className="p-3 bg-gray-100/50 border-b border-gray-200 flex gap-2 shrink-0 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input 
                placeholder="Tìm kiếm..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9 bg-white"
              />
            </div>
            <div className="flex items-center gap-2 bg-white border rounded-md px-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[110px] border-0 focus:ring-0 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Tất cả</SelectItem>
                  <SelectItem value="Set">Bối Cảnh</SelectItem>
                  <SelectItem value="Prop">Đạo Cụ</SelectItem>
                  <SelectItem value="Character">Nhân Vật</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KHU VỰC 3: DANH SÁCH ELEMENTS */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2 pb-10">
              {displayedElements.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 text-sm">Không tìm thấy kết quả nào.</div>
              ) : (
                displayedElements.map((el) => (
                  <div key={el.id} className="group flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(el.category)}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{el.name}</p>
                          {el.count > 0 && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px] py-0 px-1.5 h-4">
                              {el.count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">{el.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{el.status}</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => router.push(`/element/${el.id}`)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingElement(el); setEditName(el.name); setEditCategory(el.category); setEditStatus(el.status); setIsEditModalOpen(true); }}><Edit className="w-4 h-4 mr-2"/> Sửa</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteElement(el.id)} className="text-red-600"><Trash className="w-4 h-4 mr-2"/> Xóa</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* MODAL SỬA */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chỉnh Sửa Hạng Mục</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tên" />
            <div className="flex gap-4">
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Set">Bối Cảnh</SelectItem><SelectItem value="Prop">Đạo Cụ</SelectItem><SelectItem value="Character">Nhân Vật</SelectItem></SelectContent>
              </Select>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Pending">Chờ xử lý</SelectItem><SelectItem value="Sourcing">Đang tìm</SelectItem><SelectItem value="Approved">Đã duyệt</SelectItem><SelectItem value="Ready">Sẵn sàng</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleEditSubmit} className="bg-black text-white">Lưu Thay Đổi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}