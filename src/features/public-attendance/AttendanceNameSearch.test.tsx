import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/public-attendance.functions",()=>({searchEventAttendanceParticipants:vi.fn()}));
import { AttendanceNameSearch } from "./AttendanceNameSearch";
describe("attendance name search",()=>{
 it("searches names within the activity and selects the same card token for check-in",async()=>{
  const search=vi.fn().mockResolvedValue([{name:"Adelmo Lopes",choirName:"Coro de Quixadá",token:"a".repeat(64),attended:false},{name:"Adelmo Silva",choirName:"Outro coro",token:"b".repeat(64),attended:true}]);
  const onSelect=vi.fn(),onOpenChange=vi.fn();
  render(<AttendanceNameSearch activityId="activity" search={search} onSelect={onSelect} onOpenChange={onOpenChange}/>);
  fireEvent.click(screen.getByRole("button",{name:"Buscar nome"}));expect(onOpenChange).toHaveBeenCalledWith(true);
  fireEvent.change(screen.getByLabelText("Nome do participante"),{target:{value:"adelmo"}});
  await screen.findByText("Adelmo Lopes");
  expect(search).toHaveBeenCalledWith({data:{activityId:"activity",query:""}});
  expect(screen.getByRole("button",{name:"Já presente"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Marcar presença"}));
  expect(onSelect).toHaveBeenCalledWith("a".repeat(64));expect(onOpenChange).toHaveBeenLastCalledWith(false);
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 });
 it("preloads once and filters each keystroke locally without network requests",async()=>{
  const search=vi.fn().mockResolvedValue([{name:"Antônio Gerbson Lima",badgeName:"Nome de crachá",choirName:"Coro",token:"a",attended:false}]);
  render(<AttendanceNameSearch activityId="activity" search={search} onSelect={vi.fn()} onOpenChange={vi.fn()}/>);
  await waitFor(()=>expect(search).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button",{name:"Buscar nome"}));
  fireEvent.change(screen.getByLabelText("Nome do participante"),{target:{value:"a"}});expect(screen.queryByText("Antônio Gerbson Lima")).toBeNull();
  fireEvent.change(screen.getByLabelText("Nome do participante"),{target:{value:"lima antonio"}});
  await screen.findByText("Antônio Gerbson Lima");
  fireEvent.change(screen.getByLabelText("Nome do participante"),{target:{value:"gerbson"}});expect(screen.getByText("Antônio Gerbson Lima")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nome do participante"),{target:{value:"cracha"}});expect(screen.getByText("Antônio Gerbson Lima")).toBeInTheDocument();
  expect(search).toHaveBeenCalledOnce();
 });
 it("surfaces preload errors and allows retry",async()=>{
  const search=vi.fn().mockRejectedValue(new Error("offline"));
  render(<AttendanceNameSearch activityId="activity" search={search} onSelect={vi.fn()} onOpenChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:"Buscar nome"}));fireEvent.change(screen.getByLabelText("Nome do participante"),{target:{value:"a"}});
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível buscar");
  search.mockResolvedValue([]);fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));await waitFor(()=>expect(screen.queryByRole("alert")).toBeNull());
 });
});
