import { redirect } from 'next/navigation';

export default function RootPage() {
  // Chuyển hướng thẳng vào trang danh sách kịch bản
  redirect('/breakdown');
}