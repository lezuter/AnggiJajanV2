import GreenTable from "@/components/GreenTable"; 

export default function ProductsPage() {
  return (
    // Tambahin overflow-x-hidden biar garis ijo "tembus" tapi gak bikin scroll
    <div className="w-full text-white pb-10 overflow-x-hidden"> 
      <div className="mb-8 pt-10 px-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2 font-mono">Product Management</h1>
          <p className="text-[#707170] text-sm font-mono">
              Manage all your game vouchers, prices, and status here.
          </p>
      </div>

      {/* TABEL: Udah w-full dari sananya */}
      <GreenTable />

    </div>
  );
}