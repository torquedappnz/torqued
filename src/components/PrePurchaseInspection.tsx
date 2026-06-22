import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { Card } from './Card';
import { Button } from './Button';
import { cn } from '../utils';

// Inspection checklist — grouped by area. Excludes high-voltage battery testing by design.
const CHECKLIST: { category: string; items: string[] }[] = [
  { category: 'Structural / Body', items: [
    'Panel alignment & gaps',
    'Paint overspray / filler (signs of prior repair)',
    'Underbody rust (critical in NZ)',
    'Chassis rail inspection',
    'Boot / firewall / engine bay (accident repair signs)',
  ]},
  { category: 'Drivetrain & Engine', items: [
    'Engine oil condition & level',
    'Coolant condition & level',
    'Brake fluid condition & level',
    'Transmission fluid',
    'Belts & hoses condition',
    'Leaks (oil / coolant / power steering)',
    'Cold start behaviour & idle quality',
    'Transmission shift quality (auto / manual)',
    'AWD / 4WD engagement (if applicable)',
  ]},
  { category: 'Brakes & Suspension', items: [
    'Brake pad thickness',
    'Brake rotor thickness',
    'Brake fluid moisture content',
    'Shock absorber condition',
    'Bushes, ball joints, wheel bearings, CV joints',
    'Steering rack play & boots',
  ]},
  { category: 'Tyres', items: [
    'Tread depth (front, rear & spare)',
    'Tyre age (DOT code)',
    'Uneven wear patterns (alignment / suspension)',
  ]},
  { category: 'Electrical & Safety', items: [
    'All exterior & interior lights',
    '12V battery health (load test — excludes HV battery)',
    'OBD-II live fault code scan',
    'A/C & heating function',
    'Windscreen wipers & washers',
  ]},
];

type Status = 'pass' | 'attention' | 'fail' | 'na';
const STATUS_META: Record<Status, { label: string; color: string }> = {
  pass: { label: 'Pass', color: 'bg-emerald-500 text-white' },
  attention: { label: 'Attention', color: 'bg-amber-500 text-white' },
  fail: { label: 'Fail', color: 'bg-torqued-red text-white' },
  na: { label: 'N/A', color: 'bg-muted/30 text-muted' },
};

const fetchDataUrl = (src: string): Promise<string | null> =>
  fetch(src).then(r => r.blob()).then(b => new Promise<string | null>(res => {
    const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = () => res(null); fr.readAsDataURL(b);
  })).catch(() => null);

export const PrePurchaseInspection: React.FC<{
  mechanicId?: string;
  workshopName?: string;
  workshopAddress?: string;
  initialRego?: string;
  initialCustomerName?: string;
  initialCustomerEmail?: string;
  initialMileage?: string;
}> = ({ mechanicId, workshopName, workshopAddress, initialRego, initialCustomerName, initialCustomerEmail, initialMileage }) => {
  const [rego, setRego] = useState(initialRego || '');
  const [vehicle, setVehicle] = useState<{ make?: string; model?: string; submodel?: string; engine?: string; year?: number } | null>(null);
  const [looking, setLooking] = useState(false);
  const [mileage, setMileage] = useState(initialMileage || '');
  const [custName, setCustName] = useState(initialCustomerName || '');
  const [custEmail, setCustEmail] = useState(initialCustomerEmail || '');
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [comments, setComments] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [mileageRequired, setMileageRequired] = useState(false);

  useEffect(() => {
    if (initialRego) lookup(initialRego);
  }, []);

  const lookup = async (plateOverride?: string) => {
    const plate = (plateOverride || rego).toUpperCase().trim();
    if (!plate) return;
    setLooking(true); setVehicle(null);
    try {
      const r = await fetch(`/api/vehicles/${encodeURIComponent(plate)}`);
      if (r.ok) {
        const d = await r.json();
        setVehicle({ make: d.make, model: d.model, submodel: d.variant || d.submodel, engine: d.engine || d.engine_code, year: d.year });
        if (d.mileage && !mileage) setMileage(String(d.mileage));
      } else {
        setVehicle({});
      }
      // Auto-fill customer details from most recent booking for this rego
      if (mechanicId) {
        const custRes = await fetch(`/api/mechanic/customer-lookup?mechanicId=${encodeURIComponent(mechanicId)}&rego=${encodeURIComponent(plate)}`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (custRes?.customer) {
          if (custRes.customer.customer_name && !custName) setCustName(custRes.customer.customer_name);
          if (custRes.customer.email && !custEmail) setCustEmail(custRes.customer.email);
          if (custRes.customer.mileage_in && !mileage) setMileage(String(custRes.customer.mileage_in));
        }
      }
      setStarted(true);
    } catch { setVehicle({}); setStarted(true); }
    finally { setLooking(false); }
  };

  const buildChecklist = () => CHECKLIST.flatMap(g => g.items.map(item => ({
    category: g.category, item, status: STATUS_META[statuses[`${g.category}::${item}`] || 'na'].label, note: notes[`${g.category}::${item}`] || '',
  })));

  const save = async (complete: boolean) => {
    if (!mechanicId) return;
    if (complete && !mileage.trim()) { setMileageRequired(true); setSavedMsg('Please enter the odometer reading before completing.'); return; }
    setMileageRequired(false); setSaving(true); setSavedMsg(null);
    let pdfBase64: string | null = null;
    if (complete) {
      try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const logo = await fetchDataUrl('/torqued-logo.png');
        const ref = `PPI-${Date.now().toString(36).toUpperCase().slice(-8)}`;
        if (logo) doc.addImage(logo, 'PNG', 15, 8, 52, 17.4);
        doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
        doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
        doc.text('PRE-PURCHASE INSPECTION', 195, 16, { align: 'right' });
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
        doc.text(`Ref #${ref}`, 195, 22, { align: 'right' });
        doc.text(new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 27, { align: 'right' });
        doc.setTextColor(21, 4, 2); doc.setFontSize(9.5);
        doc.setFont('Helvetica', 'bold'); doc.text('WORKSHOP', 15, 44);
        doc.setFont('Helvetica', 'normal'); doc.text(workshopName || 'Torqued Workshop', 15, 50);
        if (workshopAddress) doc.splitTextToSize(workshopAddress, 90).forEach((l: string, i: number) => doc.text(l, 15, 55 + i * 5));
        doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER', 115, 44);
        doc.setFont('Helvetica', 'normal');
        if (custName) doc.text(custName, 115, 50);
        if (custEmail) doc.text(custEmail, 115, custName ? 55 : 50);
        doc.setFont('Helvetica', 'bold'); doc.text('VEHICLE', 165, 44);
        doc.setFont('Helvetica', 'normal');
        const vDesc = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
        if (vDesc) doc.text(doc.splitTextToSize(vDesc, 38), 165, 50);
        doc.text(rego.toUpperCase(), 165, 60);
        if (mileage) doc.text(`${Number(mileage).toLocaleString()} km`, 165, 65);
        let y = 76;
        const ensure = (need: number) => { if (y + need > 280) { doc.addPage(); y = 20; } };
        buildChecklist().reduce((group: string, c: any) => {
          if (c.category !== group) {
            ensure(14); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
            doc.text(c.category.toUpperCase(), 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2);
            y += 8;
          }
          doc.setFontSize(8.5); doc.setTextColor(21, 4, 2);
          const stKey = c.status === 'Pass' ? 'pass' : c.status === 'Attention Needed' ? 'attention' : c.status === 'Fail' ? 'fail' : 'na';
          ensure(c.note ? 10 : 6);
          doc.setFont('Helvetica', 'normal'); doc.text(doc.splitTextToSize(c.item, 150), 15, y);
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(...(stKey === 'pass' ? [16, 185, 129] : stKey === 'attention' ? [217, 119, 6] : stKey === 'fail' ? [255, 24, 0] : [120, 120, 120]) as [number, number, number]);
          doc.text(c.status, 195, y, { align: 'right' });
          doc.setTextColor(21, 4, 2); y += 5;
          if (c.note) { doc.setFont('Helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100); doc.splitTextToSize(`— ${c.note}`, 170).forEach((l: string) => { doc.text(l, 18, y); y += 4; }); doc.setFontSize(8.5); }
          y += 1;
          return c.category;
        }, '');
        const block = (title: string, text: string) => { if (!text.trim()) return; ensure(16); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0); doc.text(title, 15, y); y += 6; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(21, 4, 2); doc.splitTextToSize(text.trim(), 180).forEach((l: string) => { ensure(5); doc.text(l, 15, y); y += 4.5; }); y += 3; };
        block("INSPECTOR'S COMMENTS", comments); block('RECOMMENDATIONS', recommendations);
        pdfBase64 = doc.output('datauristring').split(',')[1];
      } catch (e) { console.warn('PDF gen failed', e); }
    }
    try {
      const r = await fetch('/api/mechanic/ppi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanicId, workshopName, rego: rego.toUpperCase().trim(),
          make: vehicle?.make, model: vehicle?.model, submodel: vehicle?.submodel, engine: vehicle?.engine,
          customerName: custName, customerEmail: custEmail, mileage,
          checklist: buildChecklist(), inspectorComments: comments, recommendations, complete, pdfBase64,
        }),
      });
      const d = await r.json();
      if (r.ok) setSavedMsg(complete ? (custEmail ? '✓ Inspection completed & report emailed to customer.' : '✓ Inspection completed & saved.') : '✓ Progress saved.');
      else setSavedMsg(d.error || 'Could not save.');
    } catch { setSavedMsg('Could not connect.'); }
    finally { setSaving(false); }
  };

  const downloadPDF = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await fetchDataUrl('/torqued-logo.png');
    const ref = `PPI-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    if (logo) doc.addImage(logo, 'PNG', 15, 8, 52, 17.4);
    doc.setFillColor(255, 24, 0); doc.rect(0, 30, 210, 2, 'F');
    doc.setTextColor(21, 4, 2); doc.setFont('Helvetica', 'bold'); doc.setFontSize(11);
    doc.text('PRE-PURCHASE INSPECTION', 195, 16, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 80);
    doc.text(`Ref #${ref}`, 195, 22, { align: 'right' });
    doc.text(new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), 195, 27, { align: 'right' });
    doc.setTextColor(21, 4, 2); doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold'); doc.text('WORKSHOP', 15, 44);
    doc.setFont('Helvetica', 'normal'); doc.text(workshopName || 'Torqued Workshop', 15, 50);
    if (workshopAddress) doc.splitTextToSize(workshopAddress, 90).forEach((l: string, i: number) => doc.text(l, 15, 55 + i * 5));
    doc.setFont('Helvetica', 'bold'); doc.text('CUSTOMER', 115, 44);
    doc.setFont('Helvetica', 'normal');
    if (custName) doc.text(custName, 115, 50);
    if (custEmail) doc.text(custEmail, 115, custName ? 55 : 50);
    doc.setFont('Helvetica', 'bold'); doc.text('VEHICLE', 165, 44);
    doc.setFont('Helvetica', 'normal');
    const vDesc = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
    if (vDesc) doc.text(doc.splitTextToSize(vDesc, 38), 165, 50);
    doc.text(rego.toUpperCase(), 165, 60);
    if (mileage) doc.text(`${Number(mileage).toLocaleString()} km`, 165, 65);
    let y = 76;
    const ensure = (need: number) => { if (y + need > 280) { doc.addPage(); y = 20; } };
    CHECKLIST.forEach(group => {
      ensure(14);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0);
      doc.text(group.category.toUpperCase(), 15, y); doc.setDrawColor(226, 232, 240); doc.line(15, y + 2, 195, y + 2);
      y += 8; doc.setFontSize(8.5); doc.setTextColor(21, 4, 2);
      group.items.forEach(item => {
        const st = statuses[`${group.category}::${item}`] || 'na';
        const note = notes[`${group.category}::${item}`] || '';
        ensure(note ? 10 : 6);
        doc.setFont('Helvetica', 'normal'); doc.text(doc.splitTextToSize(item, 150), 15, y);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...(st === 'pass' ? [16, 185, 129] : st === 'attention' ? [217, 119, 6] : st === 'fail' ? [255, 24, 0] : [120, 120, 120]) as [number, number, number]);
        doc.text(STATUS_META[st].label, 195, y, { align: 'right' });
        doc.setTextColor(21, 4, 2); y += 5;
        if (note) { doc.setFont('Helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100); doc.splitTextToSize(`— ${note}`, 170).forEach((l: string) => { doc.text(l, 18, y); y += 4; }); doc.setFontSize(8.5); doc.setTextColor(21, 4, 2); }
      });
      y += 3;
    });
    const block = (title: string, text: string) => { if (!text.trim()) return; ensure(16); doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 24, 0); doc.text(title, 15, y); y += 6; doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(21, 4, 2); doc.splitTextToSize(text.trim(), 180).forEach((l: string) => { ensure(5); doc.text(l, 15, y); y += 4.5; }); y += 3; };
    block("INSPECTOR'S COMMENTS", comments); block('RECOMMENDATIONS', recommendations);
    ensure(12);
    doc.setFont('Helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text('Pre-Purchase Inspection via Torqued. Does NOT include high-voltage (hybrid/EV) battery testing. A visual & functional assessment only — not a guarantee of future reliability. Prices include 15% GST.', 15, Math.min(y + 4, 290), { maxWidth: 180 });
    doc.save(`Torqued-PPI-${rego.toUpperCase()}.pdf`);
  };

  const inp = 'w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-torqued-red';

  return (
    <div className="space-y-6 max-w-3xl pb-12">
      <Card className="p-6 bg-card border-border space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-tight">Pre-Purchase Inspection</h3>
          <p className="text-xs text-muted mt-1">Enter the vehicle's plate to begin. $199 flat fee · excludes high-voltage (hybrid/EV) battery testing.</p>
        </div>
        <div className="flex gap-3">
          <input value={rego} onChange={e => setRego(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="Number plate" className={`${inp} font-mono tracking-widest flex-1`} />
          <Button onClick={() => lookup()} disabled={looking || !rego.trim()} className="bg-torqued-red text-white shrink-0">{looking ? 'Looking up…' : 'Start inspection'}</Button>
        </div>
        {started && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="sm:col-span-2 text-xs text-muted">
              {vehicle?.make ? <span className="text-foreground font-bold">{[vehicle.year, vehicle.make, vehicle.model, vehicle.submodel].filter(Boolean).join(' ')}{vehicle.engine ? ` · ${vehicle.engine}` : ''}</span> : 'Vehicle not found in registry — enter details manually below.'}
            </div>
            <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name" className={inp} />
            <input value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="Customer email (report will be emailed on completion)" className={inp} />
            <input value={mileage} onChange={e => { setMileage(e.target.value); setMileageRequired(false); }} placeholder="Odometer reading (km) *" inputMode="numeric" className={`${inp} ${mileageRequired ? 'border-torqued-red ring-1 ring-torqued-red' : ''}`} />
          </div>
        )}
      </Card>

      {started && (
        <>
          {CHECKLIST.map(group => (
            <Card key={group.category} className="p-5 bg-card border-border space-y-3">
              <h4 className="text-sm font-black uppercase tracking-widest text-torqued-red">{group.category}</h4>
              <div className="space-y-3">
                {group.items.map(item => {
                  const key = `${group.category}::${item}`;
                  const st = statuses[key] || 'na';
                  return (
                    <div key={key} className="space-y-1.5 border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-sm text-foreground">{item}</span>
                        <div className="flex gap-1">
                          {(Object.keys(STATUS_META) as Status[]).map(s => (
                            <button key={s} onClick={() => setStatuses(p => ({ ...p, [key]: s }))}
                              className={cn('text-[10px] font-black uppercase px-2 py-1 rounded transition-all', st === s ? STATUS_META[s].color : 'bg-background border border-border text-muted hover:text-foreground')}>
                              {STATUS_META[s].label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(st === 'attention' || st === 'fail') && (
                        <input value={notes[key] || ''} onChange={e => setNotes(p => ({ ...p, [key]: e.target.value }))}
                          placeholder="Add a note (what you found)…" className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-torqued-red" />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          <Card className="p-5 bg-card border-border space-y-3">
            <h4 className="text-sm font-black uppercase tracking-widest text-torqued-red">Inspector's Comments</h4>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={4} placeholder="Overall condition, anything notable about the vehicle…" className={`${inp} min-h-[90px]`} />
            <h4 className="text-sm font-black uppercase tracking-widest text-torqued-red pt-2">Recommendations</h4>
            <textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} rows={4} placeholder="What the buyer should address / budget for…" className={`${inp} min-h-[90px]`} />
          </Card>

          {savedMsg && <p className={cn('text-sm font-bold', savedMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red')}>{savedMsg}</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-border text-foreground" disabled={saving} onClick={() => save(false)}>Save progress</Button>
            <Button className="bg-torqued-red text-white" disabled={saving} onClick={() => save(true)}>Complete inspection</Button>
            <Button variant="outline" className="border-border text-foreground" onClick={downloadPDF}>Download PDF report</Button>
          </div>
        </>
      )}
    </div>
  );
};
