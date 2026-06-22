import React, { useState, useEffect, useRef } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { authPasskey, registerPasskey, passkeysSupported, hasPasskey } from '../lib/passkey';
import { LayoutDashboard, Search, Wrench, BookOpen, Shield, Rocket, ChevronRight, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

export const AdminPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [setupPw, setSetupPw] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [tab, setTab] = useState<'overview' | 'search' | 'mechanics' | 'bookings' | 'compliance' | 'postmvp'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [mechFilter, setMechFilter] = useState<'all' | 'live' | 'onboarding'>('all');
  const [bookings, setBookings] = useState<any[]>([]);

  const [q, setQ] = useState('');
  const [sBookings, setSBookings] = useState<any[]>([]);
  const [sPeople, setSPeople] = useState<any[]>([]);
  const [sVehicles, setSVehicles] = useState<any[]>([]);
  const [sHistory, setSHistory] = useState<any[]>([]);
  const [edit, setEdit] = useState<{ kind: 'booking' | 'profile'; row: any } | null>(null);

  const [onb, setOnb] = useState<{ name: string; legal_name: string; email: string; address: string; phone: string; owner_name: string; owner_phone: string; nzbn: string; years_in_trade: string; labour_rate: string; technicians: string; parts_lead_days: string; billing: string; trialDays: string; billing_start_date: string }>(
    { name: '', legal_name: '', email: '', address: '', phone: '', owner_name: '', owner_phone: '', nzbn: '', years_in_trade: '', labour_rate: '', technicians: '1', parts_lead_days: '1', billing: 'stripe', trialDays: '30', billing_start_date: new Date().toISOString().slice(0,10) });
  const [onbBusy, setOnbBusy] = useState(false);
  const [onbMsg, setOnbMsg] = useState<string | null>(null);
  const onboardMechanic = async () => {
    setOnbBusy(true); setOnbMsg(null);
    try {
      const res = await fetch('/api/admin/onboard-mechanic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...onb }),
      });
      const d = await res.json();
      if (!res.ok) { setOnbMsg(d.error || 'Onboarding failed'); return; }
      setOnbMsg(d.activated
        ? `✓ ${onb.name} onboarded with complimentary access — live now. Login link emailed.`
        : `✓ ${onb.name} onboarded. Subscription activation link emailed${onb.billing === 'trial' ? ` (${onb.trialDays}-day free trial)` : ''} — they go live once payment is set up.`);
      setOnb({ name: '', legal_name: '', email: '', address: '', phone: '', owner_name: '', owner_phone: '', nzbn: '', years_in_trade: '', labour_rate: '', technicians: '1', parts_lead_days: '1', billing: 'stripe', trialDays: '30', billing_start_date: new Date().toISOString().slice(0,10) });
      await loadAll(key);
    } catch {
      setOnbMsg('Could not connect.');
    } finally { setOnbBusy(false); }
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('setup');
    if (s) { setSetupToken(s); window.history.replaceState({}, document.title, window.location.pathname); }
  }, []);

  const loadAll = async (k: string) => {
    const res = await fetch(`/api/admin/overview?key=${encodeURIComponent(k)}`);
    if (!res.ok) return false;
    setOverview(await res.json());
    const [m, b] = await Promise.all([
      fetch(`/api/admin/mechanics?key=${encodeURIComponent(k)}`).then(r => r.json()),
      fetch(`/api/admin/bookings?key=${encodeURIComponent(k)}`).then(r => r.json()),
    ]);
    setMechanics(m.mechanics || []); setBookings(b.bookings || []);
    return true;
  };

  const login = async () => {
    setAuthError(null);
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await res.json();
    if (!res.ok) { setAuthError(d.error || 'Login failed'); return; }
    setKey(d.key); await loadAll(d.key); setAuthed(true);
    if (passkeysSupported() && email && !(await hasPasskey('admin', email))) {
      try {
        if (window.confirm('Set up a passkey for faster sign-in next time? You\'ll use Face ID / Touch ID instead of a password.')) {
          await registerPasskey('admin', email);
          window.alert('Passkey added. Next time, tap "Sign in with passkey".');
        }
      } catch { }
    }
  };

  const loginPasskey = async () => {
    setAuthError(null);
    try {
      const r = await authPasskey('admin', email || undefined);
      if (!r.key) throw new Error('No session returned');
      setKey(r.key); await loadAll(r.key); setAuthed(true);
    } catch (e: any) {
      setAuthError(e?.message || 'Passkey sign-in failed');
    }
  };

  const [privacyRequests, setPrivacyRequests] = useState<any[]>([]);
  const [privacyForm, setPrivacyForm] = useState({ email: '', type: 'export', notes: '' });
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState<string | null>(null);
  const [aiEmail, setAiEmail] = useState('');
  const [aiCustomer, setAiCustomer] = useState<any | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiReason, setAiReason] = useState<'request' | 'ban'>('request');

  const loadPrivacyRequests = async () => {
    const r = await fetch(`/api/admin/privacy-requests?key=${encodeURIComponent(key)}`);
    if (r.ok) { const d = await r.json(); setPrivacyRequests(d.requests || []); }
  };

  const submitPrivacyRequest = async () => {
    if (!privacyForm.email) return;
    setPrivacyBusy(true); setPrivacyMsg(null);
    try {
      const r = await fetch('/api/admin/privacy-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, customerEmail: privacyForm.email, requestType: privacyForm.type, notes: privacyForm.notes }),
      });
      const d = await r.json();
      if (!r.ok) { setPrivacyMsg(d.error || 'Failed'); return; }
      setPrivacyMsg(`✓ ${privacyForm.type === 'delete' ? 'Deletion' : 'Export'} request logged.`);
      setPrivacyForm({ email: '', type: 'export', notes: '' });
      await loadPrivacyRequests();
    } catch { setPrivacyMsg('Could not connect.'); }
    finally { setPrivacyBusy(false); }
  };

  const lookupAiCustomer = async () => {
    if (!aiEmail) return;
    setAiBusy(true); setAiCustomer(null); setAiMsg(null); setAiReason('request');
    try {
      const r = await fetch(`/api/admin/customer-ai-status?key=${encodeURIComponent(key)}&email=${encodeURIComponent(aiEmail)}`);
      const d = await r.json();
      if (!r.ok) { setAiMsg(d.error || 'Not found'); return; }
      setAiCustomer(d);
    } catch { setAiMsg('Could not connect.'); }
    finally { setAiBusy(false); }
  };

  const toggleAi = async (disable: boolean) => {
    if (!aiCustomer) return;
    setAiBusy(true); setAiMsg(null);
    try {
      const r = await fetch('/api/admin/toggle-customer-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, customerEmail: aiCustomer.email, disabled: disable, reason: disable ? aiReason : 'request' }),
      });
      const d = await r.json();
      if (!r.ok) { setAiMsg(d.error || 'Failed'); return; }
      setAiCustomer((c: any) => ({ ...c, ai_disabled: d.ai_disabled, ai_reason: d.reason }));
      if (!disable) {
        setAiMsg('✓ AI features re-enabled — customer notified by email.');
      } else if (aiReason === 'ban') {
        setAiMsg('✓ AI features disabled (ban). Customer was NOT notified.');
      } else {
        setAiMsg('✓ AI features disabled — customer notified by email.');
      }
    } catch { setAiMsg('Could not connect.'); }
    finally { setAiBusy(false); }
  };

  const [mechDetail, setMechDetail] = useState<any | null>(null);
  const [adminAddress, setAdminAddress] = useState('');
  const [adminAddressBusy, setAdminAddressBusy] = useState(false);
  const [adminAddressMsg, setAdminAddressMsg] = useState<string | null>(null);
  const [adminAddrSuggestions, setAdminAddrSuggestions] = useState<{ display_name: string }[]>([]);
  const adminAddrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adminLabourRate, setAdminLabourRate] = useState('');
  const [adminLabourRateBusy, setAdminLabourRateBusy] = useState(false);
  const [adminLabourRateMsg, setAdminLabourRateMsg] = useState<string | null>(null);
  const [wofBusy, setWofBusy] = useState(false);
  const [wofMsg, setWofMsg] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminNameBusy, setAdminNameBusy] = useState(false);
  const [adminNameMsg, setAdminNameMsg] = useState<string | null>(null);

  const saveAdminName = async (mechanicId: string) => {
    if (!adminName.trim()) return;
    setAdminNameBusy(true); setAdminNameMsg(null);
    try {
      const r = await fetch('/api/admin/update-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, id: mechanicId, fields: { name: adminName.trim() } }),
      });
      const d = await r.json();
      if (r.ok) {
        setAdminNameMsg('✓ Workshop name updated');
        setMechDetail((prev: any) => prev ? { ...prev, profile: { ...prev.profile, name: adminName.trim() } } : prev);
        await loadAll(key);
      } else { setAdminNameMsg(d.error || 'Failed to update name'); }
    } catch { setAdminNameMsg('Could not connect.'); }
    finally { setAdminNameBusy(false); }
  };

  const saveAdminAddress = async (mechanicId: string) => {
    if (!adminAddress.trim()) return;
    setAdminAddressBusy(true); setAdminAddressMsg(null);
    try {
      const r = await fetch('/api/mechanic/update-address', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId, address: adminAddress.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        setAdminAddressMsg('✓ Address updated & geocoded');
        setMechDetail((prev: any) => prev ? { ...prev, profile: { ...prev.profile, address: adminAddress.trim() } } : prev);
      } else {
        setAdminAddressMsg(d.error || 'Failed to update address');
      }
    } catch { setAdminAddressMsg('Could not connect.'); }
    finally { setAdminAddressBusy(false); }
  };

  const [promoType, setPromoType] = useState<'free_months' | 'percent_off'>('free_months');
  const [promoMonths, setPromoMonths] = useState('3');
  const [promoPercent, setPromoPercent] = useState('50');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  const applyPromo = async (mechanicId: string) => {
    setPromoBusy(true); setPromoMsg(null);
    try {
      const r = await fetch('/api/admin/apply-promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mechanicId, promoType, months: promoMonths, percent: promoPercent }),
      });
      const d = await r.json();
      if (r.ok) {
        setPromoMsg(`✓ ${d.message}`);
        await loadAll(key);
      } else {
        setPromoMsg(d.error || 'Failed');
      }
    } catch { setPromoMsg('Could not connect.'); }
    finally { setPromoBusy(false); }
  };

  const [docMechId, setDocMechId] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDesc, setDocDesc] = useState('');
  const [docBusy, setDocBusy] = useState(false);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [docList, setDocList] = useState<any[]>([]);
  // Document REQUESTS (email the workshop to send docs in; track status + internal notes)
  const [docReqList, setDocReqList] = useState<any[]>([]);
  const [docReqDesc, setDocReqDesc] = useState('');
  const [docReqBusy, setDocReqBusy] = useState(false);
  const [docReqMsg, setDocReqMsg] = useState<string | null>(null);

  const loadDocRequests = async (mechId: string) => {
    try {
      const r = await fetch(`/api/admin/document-requests/${mechId}?key=${encodeURIComponent(key)}`);
      const d = await r.json();
      setDocReqList(d.requests || []);
    } catch { setDocReqList([]); }
  };

  const sendDocRequest = async () => {
    if (!docMechId || !docReqDesc.trim()) return;
    setDocReqBusy(true); setDocReqMsg(null);
    try {
      const r = await fetch('/api/admin/document-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mechanicId: docMechId, description: docReqDesc.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setDocReqMsg('✓ Request emailed to the workshop.'); setDocReqDesc(''); await loadDocRequests(docMechId); }
      else setDocReqMsg(d.error || 'Could not send request.');
    } catch { setDocReqMsg('Could not connect.'); }
    finally { setDocReqBusy(false); }
  };

  const updateDocRequest = async (id: string, patch: { status?: string; internal_comment?: string }) => {
    try {
      const r = await fetch('/api/admin/document-request-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, id, ...patch }),
      });
      const d = await r.json();
      if (r.ok && d.request) setDocReqList(list => list.map(x => x.id === id ? d.request : x));
    } catch { /* keep local */ }
  };

  const loadDocuments = async (mechId: string) => {
    try {
      const r = await fetch(`/api/admin/documents/${mechId}?key=${encodeURIComponent(key)}`);
      const d = await r.json();
      setDocList(d.documents || []);
    } catch { setDocList([]); }
  };

  const uploadDocument = async () => {
    if (!docFile || !docMechId) return;
    setDocBusy(true); setDocMsg(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(docFile);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const r = await fetch('/api/admin/upload-document', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, mechanicId: docMechId, fileBase64: base64, fileName: docFile!.name, mimeType: docFile!.type, description: docDesc }),
        });
        const d = await r.json();
        if (r.ok) {
          setDocMsg('✓ Document uploaded successfully.');
          setDocFile(null); setDocDesc('');
          await loadDocuments(docMechId!);
        } else { setDocMsg(d.error || 'Upload failed'); }
        setDocBusy(false);
      };
    } catch { setDocMsg('Upload failed.'); setDocBusy(false); }
  };

  const loadLogoDataUrl = (src: string): Promise<string | null> =>
    new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { try { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); } catch { resolve(null); } };
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const downloadAgreementPdf = async (p: any) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    const contentW = 210 - margin * 2;
    let y = 35;

    const checkY = (n = 10) => { if (y + n > 277) { doc.addPage(); y = 20; } };
    const writeText = (text: string, size: number, bold = false, color: [number,number,number] = [21,4,2]) => {
      doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, contentW); checkY(lines.length * (size * 0.4));
      doc.text(lines, margin, y); y += lines.length * (size * 0.4) + 2;
    };
    const writePara = (text: string) => {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(30,30,30);
      const lines = doc.splitTextToSize(text, contentW); checkY(lines.length * 4);
      doc.text(lines, margin, y); y += lines.length * 4 + 3;
    };
    const writeSection = (title: string) => {
      checkY(14); y += 4;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,24,0);
      doc.text(title, margin, y); y += 6; doc.setTextColor(0,0,0);
    };

    const logo = await loadLogoDataUrl('/torqued-logo.png');
    if (logo) doc.addImage(logo, 'PNG', margin, 8, 48, 16);
    doc.setFillColor(255,24,0); doc.rect(0, 28, 210, 1.5, 'F');

    const today = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const todayStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    const workshopName = p.legal_name || p.name || '[Workshop]';
    const address = p.address ? `${p.address}, New Zealand` : '[Workshop Address], New Zealand';

    writeText('TORQUED NZ MECHANIC PLATFORM AGREEMENT', 14, true);
    y += 2;
    writeText(`Date: ${todayStr}`, 9, false, [80,80,80]);
    if (p.agreement_signed_at) writeText(`Originally signed: ${new Date(p.agreement_signed_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}`, 9, false, [80,80,80]);
    y += 3;

    writeSection('PARTIES');
    writePara(`This Agreement is entered into between:`);
    writePara(`Platform Provider: Torqued NZ Limited ("Torqued"), a New Zealand company operating the Torqued mechanic marketplace platform.`);
    writePara(`Workshop: ${workshopName}, trading as ${p.name || workshopName}, located at ${address}${p.nzbn ? `, NZBN: ${p.nzbn}` : ''} ("Workshop").`);

    writeSection('SERVICES & COMMISSION');
    writePara(`1.1 Torqued provides an online platform connecting vehicle owners with independent automotive workshops for the purpose of quoting, booking, and managing vehicle repair and maintenance services.`);
    writePara(`1.2 The Workshop agrees to use the Torqued platform to receive job requests, submit quotes, and communicate with customers. Torqued will facilitate payments and handle customer-facing communications on behalf of the Workshop.`);
    writePara(`1.3 Commission: Torqued retains a 4% commission on the value of each completed job (excluding GST) as a platform facilitation fee. Remaining funds are disbursed to the Workshop's nominated bank account within 2 business days of job completion and customer payment confirmation.`);

    writeSection('SUBSCRIPTION');
    writePara(`2.1 Workshop access to the Torqued platform is conditional on maintaining an active subscription. The current subscription plan is $99/month + GST, billed monthly.`);
    writePara(`2.2 Torqued reserves the right to adjust subscription pricing with 30 days' written notice. Continued use of the platform after the notice period constitutes acceptance of the new pricing.`);

    writeSection('WORKSHOP OBLIGATIONS');
    writePara(`3.1 The Workshop agrees to: (a) maintain all applicable trade qualifications, certifications, and licences required to perform automotive services in New Zealand; (b) hold current public liability insurance of no less than $1,000,000 NZD; (c) respond to quote requests within 24 business hours; (d) perform all services to the standard of a competent automotive professional; (e) honour all quotes accepted by customers within the agreed timeframe.`);
    writePara(`3.2 The Workshop must not solicit customers sourced through the Torqued platform for direct bookings that circumvent the Torqued commission structure for a period of 12 months following the last Torqued-facilitated interaction.`);

    writeSection('PLATFORM RULES');
    writePara(`4.1 The Workshop must not misrepresent their qualifications, capacity, or service offerings on the platform.`);
    writePara(`4.2 Torqued may suspend or terminate the Workshop's access to the platform immediately for: (a) breach of this Agreement; (b) customer complaints indicating unsafe or unprofessional conduct; (c) failure to maintain required qualifications or insurance; (d) fraudulent activity.`);

    writeSection('PAYMENTS & REFUNDS');
    writePara(`5.1 Customer payments are processed by Torqued. Torqued holds funds until job completion is confirmed by the customer or 48 hours after the stated completion date (whichever is earlier).`);
    writePara(`5.2 Refund policy: Full refund if cancellation is received more than 24 hours before the scheduled drop-off. Cancellations within 24 hours receive a 50% refund per this Agreement, with the remaining 50% disbursed to the Workshop as a cancellation fee.`);

    writeSection('LIMITATION OF LIABILITY');
    writePara(`6.1 Torqued is not liable for any indirect, special, or consequential damages arising from use of the platform, including but not limited to loss of revenue, data, or business opportunity.`);
    writePara(`6.2 Torqued's total liability to the Workshop for any claim arising from this Agreement shall not exceed the total subscription fees paid in the 3 months preceding the claim.`);

    writeSection('GENERAL');
    writePara(`7.1 This Agreement is governed by the laws of New Zealand. Disputes shall be resolved by the parties in good faith, and if unresolved, referred to mediation before litigation.`);
    writePara(`7.2 The parties are independent contractors. Nothing in this Agreement creates an employment, partnership, agency, or joint venture relationship.`);
    writePara(`7.3 Torqued may amend this Agreement on 30 days' written notice. Continued use of the platform constitutes acceptance of amendments.`);

    if (p.agreement_signed_at && p.owner_name) {
      writeSection('SIGNATURE');
      writePara(`Signed by ${p.owner_name}${p.signer_title ? `, ${p.signer_title}` : ''} on behalf of ${workshopName}.`);
      writePara(`Electronically signed via Torqued onboarding portal on ${new Date(p.agreement_signed_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
    }

    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(150,150,150);
    doc.text('Torqued NZ Mechanic Platform Agreement. This document constitutes a binding agreement between Torqued NZ and the Workshop.', margin, 285, { maxWidth: contentW });

    doc.save(`Torqued-Agreement-${(p.name || 'Workshop').replace(/[^a-z0-9]/gi, '-')}.pdf`);
  };

  const viewMechanic = async (id: string) => {
    setMechDetail({ loading: true });
    setPromoMsg(null); setPromoBusy(false);
    setAdminAddressMsg(null); setAdminAddressBusy(false); setAdminAddrSuggestions([]);
    setDocMechId(id); setDocList([]); setDocMsg(null); setDocFile(null); setDocDesc('');
    setDocReqList([]); setDocReqDesc(''); setDocReqMsg(null);
    const r = await fetch(`/api/admin/mechanic/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
    const d = await r.json();
    setMechDetail(r.ok ? d : null);
    if (r.ok) {
      setAdminAddress(d.profile?.address || '');
      setAdminName(d.profile?.name || '');
      setAdminNameMsg(null);
      setAdminLabourRate(d.profile?.labour_rate != null ? String(d.profile.labour_rate) : '');
      setAdminLabourRateMsg(null);
      setWofMsg(null); setWofBusy(false);
      await loadDocuments(id);
      await loadDocRequests(id);
    }
  };

  const saveAdminLabourRate = async (mechanicId: string) => {
    const rate = parseFloat(adminLabourRate);
    if (!rate || rate <= 0) return;
    setAdminLabourRateBusy(true); setAdminLabourRateMsg(null);
    try {
      const r = await fetch('/api/admin/update-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, id: mechanicId, fields: { labour_rate: rate } }),
      });
      const d = await r.json();
      if (r.ok) {
        setAdminLabourRateMsg(`✓ Labour rate updated to $${rate}/hr`);
        setMechDetail((prev: any) => prev ? { ...prev, profile: { ...prev.profile, labour_rate: rate } } : prev);
      } else { setAdminLabourRateMsg(d.error || 'Failed'); }
    } catch { setAdminLabourRateMsg('Could not connect.'); }
    finally { setAdminLabourRateBusy(false); }
  };
  const resetPassword = async (userId: string) => {
    if (!window.confirm('Email a password reset link to this user?')) return;
    const r = await fetch('/api/admin/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, userId }),
    });
    const d = await r.json();
    window.alert(d.success ? 'Reset link emailed.' : (d.error || 'Failed'));
  };

  const [detail, setDetail] = useState<any | null>(null);
  const viewBooking = async (id: string) => {
    setDetail({ loading: true });
    const r = await fetch(`/api/admin/booking/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
    const d = await r.json();
    setDetail(r.ok ? d : null);
  };
  const refundBooking = async (b: any) => {
    const amt = window.prompt('Refund amount (NZD). Leave blank for a FULL refund:');
    if (amt == null) return;
    const r = await fetch('/api/stripe/refund', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, amount: amt.trim() ? parseFloat(amt) : undefined }),
    });
    const d = await r.json();
    window.alert(d.success ? `Refunded $${d.refunded}.` : (d.error || 'Refund failed.'));
    if (d.success) { await loadAll(key); if (q) runSearch(); }
  };

  const cancelBooking = async (b: any) => {
    if (!window.confirm(`Cancel booking ${b.id}${b.vehicle_rego ? ` (${b.vehicle_rego})` : ''}? This updates it system-wide.`)) return;
    await fetch('/api/admin/update-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, id: b.id, fields: { status: 'cancelled' } }),
    });
    setSBookings(bs => bs.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x));
    setBookings(bs => bs.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x));
    await loadAll(key);
    if (q) runSearch();
  };

  const runSearch = async () => {
    const r = await fetch(`/api/admin/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`).then(r => r.json());
    setSBookings(r.bookings || []); setSPeople(r.people || []);
    setSVehicles(r.vehicles || []); setSHistory(r.history || []);
  };

  const saveEdit = async () => {
    if (!edit) return;
    const url = edit.kind === 'booking' ? '/api/admin/update-booking' : '/api/admin/update-profile';
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, id: edit.row.id, fields: edit.row }) });
    setEdit(null);
    runSearch();
  };

  const inp = "w-full bg-background border border-border rounded-xl px-3 h-10 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red";
  const inpFull = "w-full bg-background border border-border rounded-lg px-3 h-10 text-sm text-foreground";

  const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-2xl font-black tracking-tight mt-1 ${accent ? 'text-torqued-red' : 'text-foreground'}`}>{value}</p>
    </div>
  );

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'mechanics', label: 'Mechanics', icon: Wrench },
    { id: 'bookings', label: 'Bookings', icon: BookOpen },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'postmvp', label: 'Post-MVP', icon: Rocket },
  ] as const;

  // ── Password setup screen ──
  if (setupToken && !setupDone) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 space-y-5">
          <Logo />
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Create admin password</h1>
          <p className="text-sm text-muted">Set a secure password (min 8 chars). This is yours alone.</p>
          <input type="password" value={setupPw} onChange={e => { setSetupPw(e.target.value); setSetupError(null); }} placeholder="New password" className={inp} />
          {setupError && <p className="text-xs text-torqued-red font-bold">{setupError}</p>}
          <Button fullWidth className="bg-torqued-red text-white" onClick={async () => {
            const res = await fetch('/api/admin/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: setupToken, password: setupPw }) });
            const d = await res.json();
            if (!res.ok) { setSetupError(d.error || 'Could not set password'); return; }
            setEmail(d.email || ''); setSetupDone(true); setSetupToken(null);
          }}>Set Password</Button>
        </div>
      </div>
    );
  }

  // ── Login screen ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-8 space-y-4">
          <Logo />
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Admin Back-Office</h1>
          {setupDone && <p className="text-xs text-emerald-600 font-bold">Password set — log in below.</p>}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email" className={inp} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            onKeyDown={e => { if (e.key === 'Enter') login(); }} className={inp} />
          {authError && <p className="text-xs text-torqued-red font-bold">{authError}</p>}
          <Button fullWidth className="bg-torqued-red text-white h-12 font-black uppercase tracking-widest" onClick={login}>Sign In</Button>
          {passkeysSupported() && (
            <button onClick={loginPasskey} className="w-full text-xs font-bold text-muted hover:text-foreground transition-colors py-2">
              Sign in with passkey (Face ID / Touch ID)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-x-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border flex flex-col md:sticky top-0 md:h-screen z-40">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Admin</span>
          </div>
          {onBack && <button onClick={onBack} className="text-xs font-bold text-muted hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors">Exit</button>}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); if (item.id === 'compliance') loadPrivacyRequests(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold uppercase tracking-wider text-xs ${tab === item.id ? 'bg-torqued-red text-white' : 'text-muted hover:bg-background hover:text-foreground'}`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {tab === item.id && <ChevronRight size={14} className="ml-auto" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto overflow-x-hidden min-w-0">

        {tab === 'overview' && overview && (
          <>
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Revenue</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Subscription income" value={`$${overview.subscriptionRevenue?.toFixed(2)}`} accent />
              <Stat label="Commission (4%)" value={`$${overview.commission?.toFixed(2)}`} accent />
              <Stat label="Refunds" value={`-$${overview.refunds?.toFixed(2)}`} />
              <Stat label="Net revenue" value={`$${overview.netRevenue?.toFixed(2)}`} accent />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground pt-2">Platform</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Mechanics" value={String(overview.mechanics)} />
              <Stat label="Active subs" value={String(overview.activeSubscriptions)} />
              <Stat label="Customers" value={String(overview.customers)} />
              <Stat label="Bookings (7d)" value={String(overview.bookingsLast7Days)} />
              <Stat label="Total bookings" value={String(overview.totalBookings)} />
              <Stat label="Completed" value={String(overview.completedBookings)} />
              <Stat label="Gross booking value" value={`$${overview.grossBookingValue?.toFixed(2)}`} />
            </div>
          </>
        )}

        {tab === 'search' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Search jobs & customers</h2>
            <div className="flex gap-2 max-w-xl">
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                placeholder="Search by booking #, plate, email, or name…" className={`flex-1 ${inp}`} />
              <Button className="bg-torqued-red text-white" onClick={runSearch}>Search</Button>
            </div>

            {sBookings.length > 0 && <h3 className="text-sm font-black uppercase text-muted">Bookings</h3>}
            {sBookings.map(b => (
              <div key={b.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{b.vehicle_rego || '—'} <span className="text-muted font-mono text-xs">#{b.id}</span></p>
                  <p className="text-xs text-muted">{b.customer_name || b.email || '—'} · {b.status} · {b.payment_status} · ${b.total_price || 0}{b.refunded_amount > 0 ? ` · refunded $${b.refunded_amount}` : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="bg-torqued-red text-white text-[10px]" onClick={() => viewBooking(b.id)}>View / Edit</Button>
                  {b.status !== 'cancelled' && <Button size="sm" variant="outline" className="text-torqued-red border-torqued-red/40 text-[10px]" onClick={() => cancelBooking(b)}>Cancel</Button>}
                </div>
              </div>
            ))}

            {sPeople.length > 0 && <h3 className="text-sm font-black uppercase text-muted pt-2">People</h3>}
            {sPeople.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{p.name} <span className="text-[10px] uppercase bg-muted/10 px-1.5 py-0.5 rounded ml-1 text-muted">{p.role}</span></p>
                  <p className="text-xs text-muted">{p.email} {p.phone ? `· ${p.phone}` : ''}{p.role === 'mechanic' ? ` · ${p.subscription_active ? 'active' : 'suspended'}` : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.role === 'mechanic' && <Button size="sm" className="bg-torqued-red text-white text-[10px]" onClick={() => viewMechanic(p.id)}>View / Edit</Button>}
                  {p.role !== 'mechanic' && <Button size="sm" variant="outline" className="text-foreground border-border text-[10px]" onClick={() => setEdit({ kind: 'profile', row: { ...p } })}>Edit</Button>}
                  <Button size="sm" variant="outline" className="text-foreground border-border text-[10px]" onClick={() => resetPassword(p.id)}>Reset PW</Button>
                </div>
              </div>
            ))}
            {sVehicles.length > 0 && <h3 className="text-sm font-black uppercase text-muted pt-2">Vehicles & service history</h3>}
            {sVehicles.map(v => {
              const hist = sHistory.filter(h => h.rego === v.rego);
              return (
                <div key={v.rego} className="bg-card border border-border rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{v.year} {v.make} {v.model} <span className="text-muted font-mono text-xs">{v.rego}</span></p>
                    <span className="text-[10px] text-muted">{v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ''} · {hist.length} record{hist.length === 1 ? '' : 's'}</span>
                  </div>
                  {hist.length > 0 && (
                    <div className="space-y-1 border-t border-border pt-2">
                      {hist.map(h => (
                        <div key={h.id} className="flex justify-between text-xs text-muted">
                          <span>{h.service_date || '—'} · {h.work_done || 'Service'}{h.provider ? ` · ${h.provider}` : ''}</span>
                          <span>{h.mileage ? `${Number(h.mileage).toLocaleString()} km` : ''}{h.price ? ` · ${h.price}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {q && sBookings.length === 0 && sPeople.length === 0 && sVehicles.length === 0 && <p className="text-muted text-sm">No matches.</p>}
          </div>
        )}

        {tab === 'mechanics' && (
          <div className="space-y-3">
            <div className="bg-card border border-torqued-red/20 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Onboard a workshop</h2>
                <p className="text-xs text-muted">Creates a live, pre-confirmed mechanic account, geocodes the address for distance search, and emails them a login link.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input value={onb.name} placeholder="Trading / Workshop Name *" onChange={e => setOnb(o => ({ ...o, name: e.target.value }))} className={inp} />
                <input value={onb.legal_name} placeholder="Legal name (if different)" onChange={e => setOnb(o => ({ ...o, legal_name: e.target.value }))} className={inp} />
                <input value={onb.email} placeholder="Email *" onChange={e => setOnb(o => ({ ...o, email: e.target.value }))} className={inp} />
                <input value={onb.nzbn} placeholder="NZBN (13 digits) *" onChange={e => setOnb(o => ({ ...o, nzbn: e.target.value }))} className={inp} />
                <input value={onb.address} placeholder="Full address *" onChange={e => setOnb(o => ({ ...o, address: e.target.value }))} className={`${inp} sm:col-span-2`} />
                <input value={onb.phone} placeholder="Workshop phone" onChange={e => setOnb(o => ({ ...o, phone: e.target.value }))} className={inp} />
                <input value={onb.years_in_trade} placeholder="Years in trade *" type="number" onChange={e => setOnb(o => ({ ...o, years_in_trade: e.target.value }))} className={inp} />
                <input value={onb.owner_name} placeholder="Owner name *" onChange={e => setOnb(o => ({ ...o, owner_name: e.target.value }))} className={inp} />
                <input value={onb.owner_phone} placeholder="Owner contact number" onChange={e => setOnb(o => ({ ...o, owner_phone: e.target.value }))} className={inp} />
                <input value={onb.labour_rate} placeholder="Labour rate ($/hr)" type="number" onChange={e => setOnb(o => ({ ...o, labour_rate: e.target.value }))} className={inp} />
                <input value={onb.technicians} placeholder="# Technicians" type="number" onChange={e => setOnb(o => ({ ...o, technicians: e.target.value }))} className={inp} />
                <input value={onb.parts_lead_days} placeholder="Parts lead (days)" type="number" onChange={e => setOnb(o => ({ ...o, parts_lead_days: e.target.value }))} className={inp} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Billing Plan</label>
                  <select value={onb.billing} onChange={e => setOnb(o => ({ ...o, billing: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-3 h-11 text-sm text-foreground focus:outline-none focus:border-torqued-red">
                    <option value="stripe">$99/mo — email Stripe activation link</option>
                    <option value="half3months">50% off first 3 months ($49.50/mo) — Stripe link</option>
                    <option value="trial">Free trial then $99/mo — Stripe link</option>
                    <option value="comp">Complimentary (free, live now)</option>
                  </select>
                </div>
                {onb.billing === 'trial' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Trial days</label>
                    <input value={onb.trialDays} onChange={e => setOnb(o => ({ ...o, trialDays: e.target.value }))} placeholder="30" className={inp} />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Subscription Start Date</label>
                  <input type="date" value={onb.billing_start_date} onChange={e => setOnb(o => ({ ...o, billing_start_date: e.target.value }))} className={inp} />
                </div>
              </div>
              {onbMsg && <p className={`text-xs font-bold ${onbMsg.startsWith('✓') ? 'text-emerald-600' : 'text-torqued-red'}`}>{onbMsg}</p>}
              <Button className="bg-torqued-red text-white" disabled={onbBusy || !onb.name || !onb.email} onClick={onboardMechanic}>
                {onbBusy ? 'Onboarding…' : 'Onboard workshop'}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Mechanics</h2>
              <div className="flex rounded-xl border border-border overflow-hidden text-[10px] font-black uppercase tracking-wider">
                {([['all','All'],['live','Live'],['onboarding','Onboarding']] as const).map(([id, label]) => {
                  const n = id === 'all' ? mechanics.length : mechanics.filter(x => id === 'live' ? (x.subscription_active && x.onboarding_complete) : !(x.subscription_active && x.onboarding_complete)).length;
                  return (
                    <button key={id} onClick={() => setMechFilter(id)} className={`px-3 py-2 transition-all ${mechFilter === id ? 'bg-torqued-red text-white' : 'bg-card text-muted hover:text-foreground'}`}>{label} ({n})</button>
                  );
                })}
              </div>
            </div>
            {mechanics.filter(m => {
              const live = m.subscription_active && m.onboarding_complete;
              return mechFilter === 'all' ? true : mechFilter === 'live' ? live : !live;
            }).map(m => {
              const live = m.subscription_active && m.onboarding_complete;
              const pending: string[] = [];
              if (!m.agreement_signed_at) pending.push('contract');
              if (!m.subscription_active) pending.push('subscription');
              if (!m.onboarding_complete) pending.push('profile');
              return (
              <div key={m.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-torqued-red/40 transition-all cursor-pointer" onClick={() => viewMechanic(m.id)}>
                <div className="min-w-0">
                  <p className="font-bold text-foreground">{m.name || m.email || 'Unnamed workshop'}</p>
                  <p className="text-xs text-muted truncate">{m.email} · ★ {m.rating || 0} ({m.review_count || 0})</p>
                  {!live && pending.length > 0 && (
                    <p className="text-[10px] font-bold text-amber-500 mt-1">Awaiting: {pending.join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${live ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>{live ? 'Live' : 'Onboarding'}</span>
                  <Button size="sm" className="bg-torqued-red text-white text-[10px]" onClick={() => viewMechanic(m.id)}>View / Edit</Button>
                  <Button size="sm" variant="outline" className="text-foreground border-border text-[10px]" onClick={async () => {
                    await fetch('/api/admin/set-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, mechanicId: m.id, active: !m.subscription_active }) });
                    setMechanics(ms => ms.map(x => x.id === m.id ? { ...x, subscription_active: !m.subscription_active } : x));
                  }}>{m.subscription_active ? 'Suspend' : 'Reactivate'}</Button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Recent Bookings</h2>
              <Button size="sm" className="bg-torqued-red text-white" onClick={async () => {
                const r = await fetch(`/api/admin/weekly-report?key=${encodeURIComponent(key)}`);
                const d = await r.json();
                const rows = d.rows || [];
                const header = 'Mechanic,Jobs,Gross,Commission (4%),Payout\n';
                const body = rows.map((x: any) => `"${(x.name || '').replace(/"/g, '""')}",${x.jobs},${x.gross},${x.commission},${x.payout}`).join('\n');
                const totals = rows.reduce((a: any, x: any) => ({ jobs: a.jobs + x.jobs, gross: a.gross + x.gross, commission: a.commission + x.commission, payout: a.payout + x.payout }), { jobs: 0, gross: 0, commission: 0, payout: 0 });
                const csv = header + body + `\n"TOTAL",${totals.jobs},${totals.gross.toFixed(2)},${totals.commission.toFixed(2)},${totals.payout.toFixed(2)}`;
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `Torqued-Weekly-Report-${(d.periodStart || '').slice(0, 10)}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}>Download weekly report (CSV)</Button>
            </div>
            {bookings.map(b => (
              <div key={b.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{b.vehicle_rego || '—'} <span className="text-muted font-mono text-xs">#{b.id}</span></p>
                  <p className="text-xs text-muted">{b.status} · {b.payment_status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-torqued-red">${b.quoted_price || b.total_price || 0}</span>
                  <Button size="sm" className="bg-torqued-red text-white text-[10px]" onClick={() => viewBooking(b.id)}>View / Edit</Button>
                  {b.status !== 'cancelled' && <Button size="sm" variant="outline" className="text-torqued-red border-torqued-red/40 text-[10px]" onClick={() => cancelBooking(b)}>Cancel</Button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'compliance' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Compliance & Privacy</h2>

            {/* AI Controls */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-black text-sm uppercase text-torqued-red">AI Feature Control</h3>
                <p className="text-xs text-muted mt-0.5">Disable or ban AI features for a customer. Select reason before disabling — bans are silent; requests notify the customer.</p>
              </div>
              <div className="flex gap-2">
                <input value={aiEmail} onChange={e => { setAiEmail(e.target.value); setAiCustomer(null); setAiMsg(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') lookupAiCustomer(); }}
                  placeholder="Customer email address" className={`flex-1 ${inp}`} />
                <button onClick={lookupAiCustomer} disabled={!aiEmail || aiBusy}
                  className="bg-muted/10 text-foreground text-xs font-bold px-4 rounded-xl disabled:opacity-40 hover:bg-muted/20 transition-colors border border-border">
                  {aiBusy ? '…' : 'Look up'}
                </button>
              </div>
              {aiCustomer && (
                <div className="bg-background rounded-xl p-4 space-y-3 border border-border">
                  <div>
                    <p className="font-bold text-foreground text-sm">{aiCustomer.name || aiCustomer.email}</p>
                    <p className="text-xs text-muted">{aiCustomer.email}</p>
                    <p className={`text-xs font-bold mt-1 ${aiCustomer.ai_disabled ? (aiCustomer.ai_reason === 'ban' ? 'text-torqued-red' : 'text-amber-500') : 'text-emerald-600'}`}>
                      {aiCustomer.ai_disabled
                        ? (aiCustomer.ai_reason === 'ban' ? '⛔ Banned — AI disabled (misuse)' : '⏸ AI disabled by customer request')
                        : '✓ AI features enabled'}
                    </p>
                  </div>
                  {!aiCustomer.ai_disabled ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setAiReason('request')}
                          className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors text-left ${aiReason === 'request' ? 'bg-amber-500/15 text-amber-700 border-amber-500/40' : 'bg-muted/5 text-muted border-border hover:border-amber-400/30'}`}>
                          <span className="block font-black">Disable by request</span>
                          <span className="font-normal opacity-75">Customer is notified</span>
                        </button>
                        <button
                          onClick={() => setAiReason('ban')}
                          className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors text-left ${aiReason === 'ban' ? 'bg-torqued-red/10 text-torqued-red border-torqued-red/30' : 'bg-muted/5 text-muted border-border hover:border-torqued-red/30'}`}>
                          <span className="block font-black">Ban — AI misuse</span>
                          <span className="font-normal opacity-75">Silent, no email sent</span>
                        </button>
                      </div>
                      <button onClick={() => toggleAi(true)} disabled={aiBusy}
                        className={`text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40 transition-colors border ${aiReason === 'ban' ? 'bg-torqued-red/10 text-torqued-red border-torqued-red/30 hover:bg-torqued-red/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'}`}>
                        {aiBusy ? 'Working…' : aiReason === 'ban' ? 'Ban this customer from AI' : 'Disable AI for this customer'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => toggleAi(false)} disabled={aiBusy}
                      className="text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-emerald-500/20 transition-colors">
                      {aiBusy ? 'Working…' : 'Re-enable AI for this customer'}
                    </button>
                  )}
                </div>
              )}
              {aiMsg && <p className={`text-xs font-bold ${aiMsg.startsWith('✓') ? 'text-emerald-600' : 'text-torqued-red'}`}>{aiMsg}</p>}
            </div>

            {/* Privacy Act Requests */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-black text-sm uppercase text-torqued-red">Privacy Act Requests</h3>
                <p className="text-xs text-muted mt-0.5">Log and manage requests under the NZ Privacy Act 2020. Data export requests must be fulfilled within 20 working days. Vehicle service history is retained indefinitely per legal obligation; only profile data is erased on deletion.</p>
              </div>
              <div className="space-y-2.5">
                <input value={privacyForm.email} onChange={e => setPrivacyForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Customer email address" className={inp} />
                <select value={privacyForm.type} onChange={e => setPrivacyForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-3 h-10 text-sm text-foreground focus:outline-none focus:border-torqued-red">
                  <option value="export">Data export request (Access request)</option>
                  <option value="delete">Deletion / erasure request</option>
                  <option value="correction">Correction request</option>
                  <option value="complaint">Privacy complaint</option>
                </select>
                <textarea value={privacyForm.notes} onChange={e => setPrivacyForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)" rows={2}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red resize-none" />
                {privacyMsg && <p className={`text-xs font-bold ${privacyMsg.startsWith('✓') ? 'text-emerald-600' : 'text-torqued-red'}`}>{privacyMsg}</p>}
                <button onClick={submitPrivacyRequest} disabled={privacyBusy || !privacyForm.email}
                  className="bg-torqued-red text-white text-xs font-bold px-5 py-2.5 rounded-xl disabled:opacity-40 hover:bg-red-700 transition-colors">
                  {privacyBusy ? 'Logging…' : 'Log Request'}
                </button>
              </div>
            </div>

            {privacyRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase text-muted">Logged Requests ({privacyRequests.length})</h3>
                {privacyRequests.map((r: any) => (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">{r.customer_email}</p>
                      <p className="text-xs text-muted">{r.request_type} · {new Date(r.created_at).toLocaleDateString('en-NZ')} · <span className={r.status === 'resolved' ? 'text-emerald-600' : 'text-amber-500'}>{r.status}</span></p>
                      {r.notes && <p className="text-xs text-muted italic mt-0.5">"{r.notes}"</p>}
                    </div>
                    {r.status !== 'resolved' && (
                      <button onClick={async () => {
                        await fetch('/api/admin/resolve-privacy-request', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key, id: r.id }),
                        });
                        await loadPrivacyRequests();
                      }} className="text-[10px] font-bold text-emerald-600 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 shrink-0 transition-colors">
                        Mark resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-4 text-xs text-muted space-y-1">
              <p className="font-bold text-foreground">Privacy Policy</p>
              <p>Published policy document: <a href="/privacy-policy.pdf" target="_blank" rel="noreferrer" className="text-torqued-red underline">View Privacy Policy PDF</a></p>
              <p>For privacy enquiries: <a href="mailto:torqued.nz@icloud.com" className="text-torqued-red">torqued.nz@icloud.com</a></p>
            </div>
          </div>
        )}

        {tab === 'postmvp' && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Post-MVP Innovations</h2>
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
              <h3 className="font-black text-torqued-red uppercase text-sm">MBI Claims (parked)</h3>
              <p className="text-sm text-muted leading-relaxed">$99 diagnostic → mechanic manual quote → customer downloads quotes as PDF for their insurer. Infrastructure exists, hidden from the live flow. Future: MBI provider integrations + automatic parts ordering.</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
              <h3 className="font-black text-torqued-red uppercase text-sm">Roadmap</h3>
              <ul className="text-sm text-muted list-disc pl-5 space-y-1"><li>Carjam/NZTA live rego lookup</li><li>Mechanic churn / switching-cost calculator</li><li>Demand trends by service &amp; region</li></ul>
            </div>
          </div>
        )}
      </main>

      {/* Mechanic detail modal */}
      {mechDetail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl my-8 bg-card border border-border rounded-3xl p-6 space-y-4">
            {mechDetail.loading ? <p className="text-muted text-sm py-8 text-center">Loading…</p> : (() => {
              const p = mechDetail.profile; const rev = mechDetail.revenue; const bl = mechDetail.billing;
              return (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black uppercase text-foreground">{p.name}</h3>
                      <p className="text-xs text-muted">{p.email} {p.phone ? `· ${p.phone}` : ''}</p>
                    </div>
                    <button onClick={() => setMechDetail(null)} className="text-muted hover:text-foreground text-2xl leading-none">×</button>
                  </div>

                  {/* Agreement PDF download */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadAgreementPdf(p)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-background text-xs font-bold hover:border-torqued-red/40 hover:text-torqued-red transition-all"
                    >
                      <Download size={13} /> Download Platform Agreement
                    </button>
                  </div>

                  <div className="bg-background rounded-xl p-3 border border-border space-y-2">
                    <p className="text-[10px] uppercase font-black text-muted">Trading / Workshop Name</p>
                    <div className="flex gap-2">
                      <input
                        value={adminName}
                        onChange={e => { setAdminName(e.target.value); setAdminNameMsg(null); }}
                        placeholder="e.g. North Mechanical"
                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-torqued-red transition-colors"
                      />
                      <button
                        onClick={() => saveAdminName(p.id)}
                        disabled={adminNameBusy || !adminName.trim()}
                        className="px-3 py-2 rounded-lg bg-torqued-red text-white text-xs font-bold disabled:opacity-40 shrink-0"
                      >{adminNameBusy ? '…' : 'Save'}</button>
                    </div>
                    {adminNameMsg && <p className={`text-[10px] font-bold ${adminNameMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red'}`}>{adminNameMsg}</p>}
                  </div>

                  <div className="bg-background rounded-xl p-3 border border-border space-y-2">
                    <p className="text-[10px] uppercase font-black text-muted">Workshop Address</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          value={adminAddress}
                          onChange={e => {
                            const val = e.target.value;
                            setAdminAddress(val); setAdminAddressMsg(null);
                            if (adminAddrTimer.current) clearTimeout(adminAddrTimer.current);
                            if (val.length < 3) { setAdminAddrSuggestions([]); return; }
                            adminAddrTimer.current = setTimeout(async () => {
                              try {
                                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=nz&limit=5&q=${encodeURIComponent(val)}`, { headers: { 'User-Agent': 'TorquedNZ/1.0 (torquedapp.nz@gmail.com)' } });
                                setAdminAddrSuggestions(await res.json() || []);
                              } catch { setAdminAddrSuggestions([]); }
                            }, 380);
                          }}
                          placeholder="Start typing address…"
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-torqued-red transition-colors"
                        />
                        {adminAddrSuggestions.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
                            {adminAddrSuggestions.map((s, i) => (
                              <button key={i} type="button"
                                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-torqued-red/10 border-b border-border last:border-0"
                                onClick={() => { setAdminAddress(s.display_name); setAdminAddrSuggestions([]); }}>
                                {s.display_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setAdminAddrSuggestions([]); saveAdminAddress(p.id); }}
                        disabled={adminAddressBusy || !adminAddress.trim()}
                        className="px-3 py-2 rounded-lg bg-torqued-red text-white text-xs font-bold disabled:opacity-40 shrink-0"
                      >
                        {adminAddressBusy ? '…' : 'Save'}
                      </button>
                    </div>
                    {adminAddressMsg && <p className={`text-[10px] font-bold ${adminAddressMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red'}`}>{adminAddressMsg}</p>}
                  </div>

                  <div className="bg-background rounded-xl p-3 border border-border space-y-2">
                    <p className="text-[10px] uppercase font-black text-muted">Labour Rate ($/hr)</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={adminLabourRate}
                        onChange={e => { setAdminLabourRate(e.target.value); setAdminLabourRateMsg(null); }}
                        placeholder="e.g. 145"
                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-torqued-red transition-colors"
                      />
                      <button
                        onClick={() => saveAdminLabourRate(p.id)}
                        disabled={adminLabourRateBusy || !adminLabourRate || parseFloat(adminLabourRate) <= 0}
                        className="px-3 py-2 rounded-lg bg-torqued-red text-white text-xs font-bold disabled:opacity-40 shrink-0"
                      >{adminLabourRateBusy ? '…' : 'Save'}</button>
                    </div>
                    {adminLabourRateMsg && <p className={`text-[10px] font-bold ${adminLabourRateMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red'}`}>{adminLabourRateMsg}</p>}
                  </div>

                  {/* WoF Servicing — disable for workshops without a WoF Authority */}
                  <div className="bg-background rounded-xl p-3 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-black text-muted">WoF Servicing</p>
                        <p className="text-xs text-muted mt-0.5">{p.wof_disabled ? 'Disabled — this workshop will not be offered for Warrant of Fitness jobs.' : 'Enabled — workshop appears for Warrant of Fitness bookings.'}</p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={!p.wof_disabled}
                        disabled={wofBusy}
                        onClick={async () => {
                          const next = !p.wof_disabled;
                          setWofBusy(true); setWofMsg(null);
                          try {
                            const r = await fetch('/api/admin/update-profile', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ key, id: p.id, fields: { wof_disabled: next } }),
                            });
                            const d = await r.json();
                            if (r.ok) {
                              setMechDetail((prev: any) => prev ? { ...prev, profile: { ...prev.profile, wof_disabled: next } } : prev);
                              setWofMsg(next ? '✓ WoF servicing disabled for this workshop' : '✓ WoF servicing enabled');
                            } else { setWofMsg(d.error || 'Failed'); }
                          } catch { setWofMsg('Could not connect.'); }
                          finally { setWofBusy(false); }
                        }}
                        className={`shrink-0 w-12 h-7 rounded-full transition-all relative disabled:opacity-50 ${!p.wof_disabled ? 'bg-emerald-500' : 'bg-border'}`}
                      >
                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${!p.wof_disabled ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    {wofMsg && <p className={`text-[10px] font-bold ${wofMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red'}`}>{wofMsg}</p>}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-background rounded-xl p-3 border border-border"><p className="text-[9px] uppercase font-black text-muted">Jobs</p><p className="text-lg font-black text-foreground">{rev.jobs}</p></div>
                    <div className="bg-background rounded-xl p-3 border border-border"><p className="text-[9px] uppercase font-black text-muted">Gross</p><p className="text-lg font-black text-foreground">${rev.gross}</p></div>
                    <div className="bg-background rounded-xl p-3 border border-border"><p className="text-[9px] uppercase font-black text-muted">Commission</p><p className="text-lg font-black text-torqued-red">${rev.commission}</p></div>
                    <div className="bg-background rounded-xl p-3 border border-border"><p className="text-[9px] uppercase font-black text-muted">Payout</p><p className="text-lg font-black text-emerald-600">${rev.payout}</p></div>
                  </div>

                  <div className="bg-background rounded-xl p-3 text-sm flex items-center justify-between flex-wrap gap-2 border border-border">
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted">Subscription</p>
                      <p className={`font-bold ${bl.active ? 'text-emerald-600' : 'text-torqued-red'}`}>{(bl.status || 'inactive').toUpperCase()}{bl.nextBilling ? ` · next ${new Date(bl.nextBilling).toLocaleDateString('en-NZ')}` : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-foreground border-border text-[10px]" onClick={() => resetPassword(p.id)}>Reset password</Button>
                      <Button size="sm" variant="outline" className="text-foreground border-border text-[10px]" onClick={async () => {
                        await fetch('/api/admin/set-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, mechanicId: p.id, active: !p.subscription_active }) });
                        setMechDetail({ ...mechDetail, profile: { ...p, subscription_active: !p.subscription_active } });
                        loadAll(key);
                      }}>{p.subscription_active ? 'Suspend' : 'Reactivate'}</Button>
                    </div>
                  </div>

                  {/* Promo / discount section */}
                  <div className="bg-background rounded-xl p-3 border border-border space-y-3">
                    <p className="text-[10px] uppercase font-black text-muted">Apply Promo</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPromoType('free_months')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${promoType === 'free_months' ? 'bg-torqued-red text-white border-torqued-red' : 'bg-background text-muted border-border hover:border-torqued-red/40'}`}
                      >
                        Free months
                      </button>
                      <button
                        onClick={() => setPromoType('percent_off')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${promoType === 'percent_off' ? 'bg-torqued-red text-white border-torqued-red' : 'bg-background text-muted border-border hover:border-torqued-red/40'}`}
                      >
                        % off
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      {promoType === 'percent_off' && (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number" min="1" max="99" value={promoPercent}
                            onChange={e => setPromoPercent(e.target.value)}
                            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground text-center font-bold"
                          />
                          <span className="text-xs text-muted shrink-0">% off</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="number" min="1" max="24" value={promoMonths}
                          onChange={e => setPromoMonths(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground text-center font-bold"
                        />
                        <span className="text-xs text-muted shrink-0">mo.</span>
                      </div>
                      <button
                        onClick={() => applyPromo(p.id)}
                        disabled={promoBusy}
                        className="px-3 py-1.5 rounded-lg bg-torqued-red text-white text-xs font-bold disabled:opacity-40"
                      >
                        {promoBusy ? '…' : 'Apply'}
                      </button>
                    </div>
                    {promoMsg && <p className={`text-xs font-bold ${promoMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red'}`}>{promoMsg}</p>}
                    <p className="text-[10px] text-muted leading-tight">
                      {p.stripe_subscription_id
                        ? 'Coupon applied to their next invoice on the existing subscription.'
                        : 'No Stripe subscription yet — will create one in trial (no card required).'}
                    </p>
                  </div>

                  {bl.invoices?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted mb-1">Subscription transactions</p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {bl.invoices.map((inv: any) => (
                          <div key={inv.id} className="flex justify-between text-xs text-muted bg-background rounded px-2 py-1 border border-border">
                            <span>{new Date(inv.date).toLocaleDateString('en-NZ')} · ${inv.amount} · {inv.status}</span>
                            {inv.url && <a href={inv.url} target="_blank" rel="noreferrer" className="text-torqued-red font-bold">Receipt</a>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase font-black text-muted mb-1">Jobs through the platform ({mechDetail.jobs.length})</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {mechDetail.jobs.length === 0 && <p className="text-xs text-muted italic">No jobs yet.</p>}
                      {mechDetail.jobs.map((j: any) => (
                        <div key={j.id} className="flex justify-between items-center text-xs text-muted bg-background rounded px-2 py-1.5 border border-border">
                          <span>{(j.date || (j.created_at || '').slice(0, 10))} · {j.vehicle_rego || '—'} · {j.status}</span>
                          <span className="flex items-center gap-2">${j.quoted_price || j.total_price || 0}
                            <button onClick={() => { setMechDetail(null); viewBooking(j.id); }} className="text-torqued-red font-bold">Open</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Document REQUESTS — email the workshop to send docs in, track status */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-[10px] uppercase font-black text-muted">Request Documents</p>
                    <p className="text-[10px] text-muted">Emails the workshop asking them to reply with the documents below. Track and resolve them here — files arrive in the Torqued inbox.</p>
                    {docReqList.length > 0 && (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {docReqList.map((r: any) => (
                          <div key={r.id} className={`rounded-xl px-3 py-2 border space-y-2 ${r.status === 'resolved' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-background'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs text-foreground whitespace-pre-line">{r.description}</p>
                                <p className="text-[9px] uppercase font-black text-muted mt-1">{r.status === 'resolved' ? `Resolved${r.resolved_at ? ' · ' + new Date(r.resolved_at).toLocaleDateString('en-NZ') : ''}` : `Pending · ${r.requested_at ? new Date(r.requested_at).toLocaleDateString('en-NZ') : ''}`}</p>
                              </div>
                              <button
                                onClick={() => updateDocRequest(r.id, { status: r.status === 'resolved' ? 'pending' : 'resolved' })}
                                className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded ${r.status === 'resolved' ? 'bg-muted/10 text-muted' : 'bg-emerald-500 text-white'}`}
                              >{r.status === 'resolved' ? 'Reopen' : 'Mark resolved'}</button>
                            </div>
                            <input
                              defaultValue={r.internal_comment || ''}
                              placeholder="Internal comment…"
                              onBlur={e => { if (e.target.value !== (r.internal_comment || '')) updateDocRequest(r.id, { internal_comment: e.target.value }); }}
                              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted outline-none focus:border-torqued-red"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <textarea
                        value={docReqDesc}
                        onChange={e => setDocReqDesc(e.target.value)}
                        placeholder={'List the documents needed (one per line)\ne.g. Public liability insurance certificate\nNZBN confirmation'}
                        rows={3}
                        className={`${inpFull} min-h-[72px] py-2`}
                      />
                      <button onClick={sendDocRequest} disabled={!docReqDesc.trim() || docReqBusy}
                        className="w-full py-2 rounded-xl bg-torqued-red text-white text-xs font-bold disabled:opacity-40">
                        {docReqBusy ? 'Sending…' : 'Email document request'}
                      </button>
                      {docReqMsg && <p className={`text-xs font-bold ${docReqMsg.startsWith('✓') ? 'text-emerald-500' : 'text-torqued-red'}`}>{docReqMsg}</p>}
                    </div>
                  </div>

                  {/* Document upload section (optional — store files we already hold) */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-[10px] uppercase font-black text-muted">Workshop Documents</p>
                    {docList.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {docList.map((doc: any) => (
                          <div key={doc.id} className="flex justify-between items-center text-xs bg-background rounded px-2 py-1.5 border border-border">
                            <span className="text-foreground truncate max-w-[200px]">{doc.file_name}{doc.description ? ` — ${doc.description}` : ''}</span>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-torqued-red font-bold shrink-0 ml-2">Download</a>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <input type="file" className="text-xs text-muted" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                      <input className={inpFull} placeholder="Description (optional)" value={docDesc} onChange={e => setDocDesc(e.target.value)} />
                      <button onClick={uploadDocument} disabled={!docFile || docBusy}
                        className="w-full py-2 rounded-xl bg-torqued-red text-white text-xs font-bold disabled:opacity-40">
                        {docBusy ? 'Uploading…' : 'Upload Document'}
                      </button>
                      {docMsg && <p className="text-xs text-emerald-500">{docMsg}</p>}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Booking detail modal */}
      {detail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg my-8 bg-card border border-border rounded-3xl p-6 space-y-4">
            {detail.loading ? <p className="text-muted text-sm py-8 text-center">Loading…</p> : (() => {
              const b = detail.booking; const m = detail.mechanic; const v = detail.vehicle;
              return (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase text-foreground">{b.vehicle_rego || '—'} <span className="font-mono text-xs text-muted">#{b.id}</span></h3>
                      <p className="text-xs text-muted">{b.status} · {b.payment_status}{b.is_cold_quote ? ' · cold quote' : ''}{b.refunded_amount > 0 ? ` · refunded $${b.refunded_amount}` : ''}</p>
                    </div>
                    <button onClick={() => setDetail(null)} className="text-muted hover:text-foreground text-2xl leading-none">×</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <p className="text-[10px] uppercase font-black text-muted mb-1">Customer</p>
                      <p className="text-foreground font-bold">{b.customer_name || '—'}</p>
                      <p className="text-muted text-xs">{b.email || '—'}</p>
                      <p className="text-muted text-xs">{b.customer_phone || b.phone || ''}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <p className="text-[10px] uppercase font-black text-muted mb-1">Mechanic</p>
                      <p className="text-foreground font-bold">{m?.name || '—'}</p>
                      <p className="text-muted text-xs">{m?.email || ''}</p>
                      <p className="text-muted text-xs">{m?.address || ''}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <p className="text-[10px] uppercase font-black text-muted mb-1">Vehicle</p>
                      <p className="text-foreground font-bold">{v ? `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() : (b.vehicle_rego || '—')}</p>
                      <p className="text-muted text-xs">{v?.variant || ''}</p>
                      <p className="text-muted text-xs">{v?.mileage ? `${Number(v.mileage).toLocaleString()} km` : ''}</p>
                    </div>
                    <div className="bg-background rounded-xl p-3 border border-border">
                      <p className="text-[10px] uppercase font-black text-muted mb-1">This job</p>
                      <p className="text-muted text-xs">{(b.service_ids || []).join(', ') || '—'}</p>
                      <p className="text-torqued-red font-black mt-1">${b.quoted_price || b.total_price || 0}</p>
                      {b.description && <p className="text-muted text-xs italic mt-1">"{b.description}"</p>}
                    </div>
                  </div>

                  {detail.torquedJobs?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted mb-1">Previous Torqued jobs ({detail.torquedJobs.length})</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {detail.torquedJobs.map((j: any) => (
                          <div key={j.id} className="flex justify-between text-xs text-muted bg-background rounded px-2 py-1 border border-border">
                            <span>{j.date || (j.created_at || '').slice(0, 10)} · {(j.service_ids || []).join(', ') || '—'}</span>
                            <span>{j.status} · ${j.quoted_price || j.total_price || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.history?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted mb-1">Service history ({detail.history.length})</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {detail.history.map((h: any) => (
                          <div key={h.id} className="flex justify-between text-xs text-muted bg-background rounded px-2 py-1 border border-border">
                            <span>{h.service_date || '—'} · {h.work_done || 'Service'}{h.provider ? ` · ${h.provider}` : ''}</span>
                            <span>{h.mileage ? `${Number(h.mileage).toLocaleString()} km` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button size="sm" className="bg-torqued-red text-white text-[10px]" onClick={() => { setEdit({ kind: 'booking', row: { ...b } }); setDetail(null); }}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/40 text-[10px]" onClick={() => refundBooking(b)}>Refund / Partial</Button>
                    {b.status !== 'cancelled' && <Button size="sm" variant="outline" className="text-torqued-red border-torqued-red/40 text-[10px]" onClick={async () => { await cancelBooking(b); setDetail(null); }}>Cancel booking</Button>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md my-8 bg-card border border-border rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-black uppercase text-foreground">Edit {edit.kind}</h3>
            <div className="space-y-3">
              {(edit.kind === 'booking'
                ? ['status', 'payment_status', 'total_price', 'quoted_price', 'date', 'customer_name', 'email', 'phone', 'vehicle_rego']
                : ['name', 'email', 'phone', 'role', 'subscription_active', 'address', 'labour_rate']
              ).map(f => (
                <div key={f}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">{f.replace(/_/g, ' ')}</label>
                  <input className={inpFull} value={edit.row[f] ?? ''} onChange={e => setEdit({ ...edit, row: { ...edit.row, [f]: e.target.value } })} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button fullWidth className="bg-torqued-red text-white" onClick={saveEdit}>Save</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
