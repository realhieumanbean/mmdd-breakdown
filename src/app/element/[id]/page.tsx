"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, UploadCloud, Image as ImageIcon, Trash2, 
  Save, Loader2, CheckCircle, MapPin, Lightbulb 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function ElementDesignBoard() {
  const params = useParams();
  const router = useRouter();
  const elementId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [element, setElement] = useState<any>(null);
  const [references, setReferences] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string>(""); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (elementId) fetchElementData();
  }, [elementId]);

  async function fetchElementData() {
    try {
      const { data: elData } = await supabase.from("elements").select("*").eq("id", elementId).single();
      if (elData) {
        setElement(elData);
        setNotes(elData.notes || "");
      }

      const { data: refData } = await supabase.from("design_references").select("*").eq("element_id", elementId).order('created_at', { ascending: false });
      setReferences(refData || []);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${elementId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('design_images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('design_images').getPublicUrl(fileName);
      
      // Lệnh INSERT này đã khớp 100% với bảng SQL ở Bước 1
      const { error: dbError } = await supabase.from("design_references").insert([{
        element_id: elementId,
        image_url: publicUrl,
        note: "",
        type: uploadingType // Khớp với cột type vừa tạo
      }]);

      if (dbError) throw dbError;
      await fetchElementData(); 
    } catch (error: any) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadingType("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleStatusChange(s: string) {
    setElement((prev: any) => ({ ...prev, status: s }));
    await supabase.from("elements").update({ status: s }).eq("id", elementId);
  }

  async function handleSaveNotes() {
    setIsSaving(true);
    await supabase.from("elements").update({ notes }).eq("id", elementId);
    setTimeout(() => setIsSaving(false), 500);
  }

  const renderSection = (title: string, icon: any, type: string, data: any[], empty: string) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
      <div className="p-4 border-b bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-gray-900">{icon} {title} ({data.length})</div>
        <Button onClick={() => { setUploadingType(type); fileInputRef.current?.click(); }} disabled={isUploading} variant="outline" size="sm">
          {isUploading && uploadingType === type ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <UploadCloud className="w-3 h-3 mr-2" />}
          Tải ảnh
        </Button>
      </div>
      <div className="p-4">
        {data.length === 0 ? <div className="py-10 text-center border-2 border-dashed rounded-lg text-gray-400 text-sm">{empty}</div> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.map((img) => (
              <div key={img.id} className="group relative rounded-lg border bg-gray-50 overflow-hidden">
                <img src={img.image_url} alt="Ref" className="w-full aspect-[4/3] object-cover" />
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="destructive" size="icon" className="h-7 w-7" onClick={async () => {
                    if(confirm("Xóa?")) { await supabase.from("design_references").delete().eq("id", img.id); fetchElementData(); }
                  }}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) return <div className="p-20 text-center text-gray-500">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-20">
      <header className="h-16 border-b bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5"/></Button>
          <div><h1 className="font-bold text-gray-900">{element?.name}</h1><Badge variant="outline" className="text-[10px] uppercase">{element?.category}</Badge></div>
        </div>
        <Select value={element?.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Pending">Chờ xử lý</SelectItem>
            <SelectItem value="Sourcing">Đang tìm</SelectItem>
            <SelectItem value="Approved">Đã duyệt</SelectItem>
            <SelectItem value="Ready">Sẵn sàng</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 uppercase text-xs tracking-widest">Ghi chú</h2>
              <Button size="sm" onClick={handleSaveNotes} disabled={isSaving}>{isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-2" />} Lưu</Button>
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mô tả chi tiết..." className="min-h-[400px] bg-gray-50/50" />
          </div>
        </div>

        <div className="lg:col-span-8">
          {renderSection("Hình ảnh Tham khảo", <Lightbulb className="w-4 h-4 text-amber-500" />, "reference", references.filter(r => r.type === 'reference'), "Chưa có ảnh ý tưởng.")}
          {renderSection("Hình ảnh Thực tế", <MapPin className="w-4 h-4 text-blue-500" />, "practical", references.filter(r => r.type === 'practical'), "Chưa có ảnh thực tế.")}
          {renderSection("Final Look", <CheckCircle className="w-4 h-4 text-emerald-500" />, "final", references.filter(r => r.type === 'final'), "Chưa có ảnh chốt.")}
        </div>
      </main>
    </div>
  );
}