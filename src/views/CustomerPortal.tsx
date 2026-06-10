import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, ChevronRight, Info, Lock, CheckCircle2, Star, Calendar, CreditCard, Car, History, Wrench, AlertTriangle, Plus, Edit2, ArrowLeft, Clock, Sun, Moon, Monitor, Download, Ticket, Mail, Send, Smartphone, X, Upload, Sparkles, Camera } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { SERVICES, MOCK_MECHANICS, MOCK_VEHICLE, MOCK_VEHICLES } from '../constants';
import { Vehicle, Mechanic, Service, Job, UserServiceItem } from '../types';
import { cn } from '../utils';
import { useTheme } from '../context/ThemeContext';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { authPasskey, registerPasskey, passkeysSupported } from '../lib/passkey';

export const CustomerPortal: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, logout, checkPlateExists, registerVehicle, updateProfile } = useAuth();

  const loadImageDataUrl = (src: string): Promise<string | null> =>
    new Promise((resolve) => {
      fetch(src)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    });

  const generateBookingPDF = async (job: Job) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const mech = MOCK_MECHANICS.find(m => m.id === job.mechanicId);

    // 1. Dark Header Ribbon - Torqued Charcoal Carbon Background
    doc.setFillColor(21, 4, 2);
    doc.rect(0, 0, 210, 42, 'F');

    // Racing Red Trim Line under header
    doc.setFillColor(255, 24, 0);
    doc.rect(0, 42, 210, 2, 'F');

    // Torqued logo (falls back to text if the image can't be loaded)
    const logoDataUrl = await loadImageDataUrl('/torqued-logo.png');
    if (logoDataUrl) {
      // logo is ~2.985:1; render 55mm wide
      doc.addImage(logoDataUrl, 'PNG', 15, 11, 55, 18.4);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('TORQ', 15, 22);
      doc.setTextColor(255, 24, 0);
      doc.text('UED', 44, 22);
    }

    // Sub Header details
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 180, 180);
    doc.text('NZ REPAIR MARKETPLACE', 15, 35);

    // Receipt Ref & Date on white-right part of header
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`RECEIPT REF: #${job.id.toUpperCase()}`, 130, 20);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text(`ISSUED: ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`, 130, 27);
    doc.text('TORQUED NZ', 130, 33);

    // 2. Document Title
    doc.setTextColor(21, 4, 2);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('SECURED BOOKING CONFIRMATION & RECEIPT', 15, 58);
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(15, 62, 195, 62);
    
    // 3. Left Column / Right Column Grid Alignment for Logistics
    // Left Grid: Booking & Schedule
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(255, 24, 0); // red headings
    doc.text('LOGISTICS / SCHEDULING', 15, 72);
    
    doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Appointment Date:', 15, 80);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text(job.date, 52, 80);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Arrival Drop Window:', 15, 87);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(255, 24, 0); // red accent for drop off
    doc.text(selectedTime || '09:00 AM', 52, 87);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Pickup Deadline:', 15, 94);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text(estimatedReadyTime || '04:30 PM (Same-Day)', 52, 94);

    // Right Grid: Workshop details
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(255, 24, 0);
    doc.text('ASSIGNED REPAIR SERVICE', 115, 72);

    doc.setFontSize(9.5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text(mech?.name || 'Selected Workshop Service', 115, 80);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.text(mech?.address || 'your mechanics address', 115, 85);
    doc.text('Authorized Torqued Certified Tech Partner', 115, 90);

    // 4. Vehicle & Customer Specifications Box (Styled split grid matching TORQUED Design Language)
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 102, 180, 28, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 102, 180, 28, 'D');

    // Vertical Divider Line between Vehicle specs and Client specs
    doc.setDrawColor(226, 232, 240);
    doc.line(105, 102, 105, 130);

    // Left Column: Vehicle Details
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.setFontSize(9);
    doc.text('ENROLLED VEHICLE SPECIFICATION', 20, 108);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Model:', 20, 115);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    const vehicleName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : `${MOCK_VEHICLE.year} ${MOCK_VEHICLE.make} ${MOCK_VEHICLE.model}`;
    doc.text(vehicleName, 32, 115);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Plate:', 20, 122);
    
    // Reg plate pill
    doc.setFillColor(21, 4, 2);
    doc.rect(32, 118, 30, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    const vehicleReg = vehicle?.rego || MOCK_VEHICLE.rego;
    doc.text(vehicleReg.toUpperCase(), 37, 122.5);

    // Right Column: Client / Owner File (Name, Email, Phone Number)
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(255, 24, 0); // Solid Scarlet Heading
    doc.setFontSize(9);
    doc.text('VERIFIED CLIENT / BILLING DOSSIER', 110, 108);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Name:', 110, 115);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    const cName = job.customerName || userProfile?.name || cardName || 'Sri Test Owner';
    doc.text(cName, 126, 115);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Email:', 110, 121);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    const cEmail = job.email || userProfile?.email || stripeInputEmail || 'sri.140nz@gmail.com';
    doc.text(cEmail.length > 34 ? cEmail.substring(0, 31) + '...' : cEmail, 126, 121);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Phone:', 110, 127);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    const cPhone = job.phone || userProfile?.phone || stripeInputPhone || '+64 21 029 3848';
    doc.text(cPhone, 126, 127);

    // 5. Booked services list section (shifted Y coordinate for professional breathing room)
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.setFontSize(10.5);
    doc.text('WORK REQUIREMENTS & SPECIALIST SERVICES', 15, 143);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 146, 195, 146);
    
    let currentY = 154;
    job.serviceIds.forEach((sid, idx) => {
      const sObj = SERVICES.find(s => s.id === sid);
      const sName = sObj?.name || 'Diagnostic Mechanical Inspection';
      const sDesc = sObj?.category ? `Service Category: ${sObj.category.toUpperCase()}` : 'Full high-value component calibration';
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(21, 4, 2);
      doc.setFontSize(9.5);
      doc.text(`[🛠️]  ${idx + 1}. ${sName}`, 15, currentY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8.5);
      doc.text(sDesc, 20, currentY + 4.5);
      
      currentY += 13;
    });

    // Divider before pricing
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + 2, 195, currentY + 2);
    
    // 6. Pricing Breakdown Box
    doc.setFillColor(248, 250, 252);
    doc.rect(115, currentY + 8, 80, 42, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(115, currentY + 8, 80, 42, 'D');
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Subtotal:', 120, currentY + 16);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text(`$${job.totalPrice}.00 NZD`, 165, currentY + 16);
    
    // On Torqued the customer prepays — either the full amount or a deposit.
    const amountPaid = job.depositPaid ?? job.totalPrice;
    const balanceDue = Math.max(0, job.totalPrice - amountPaid);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Prepaid via Torqued:', 120, currentY + 24);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(21, 4, 2);
    doc.text(`$${amountPaid.toFixed(2)} NZD`, 165, currentY + 24);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    if (balanceDue <= 0) {
      doc.setTextColor(16, 150, 70); // green
      doc.text('Balance Due:', 120, currentY + 40);
      doc.text('PAID IN FULL', 165, currentY + 40);
    } else {
      doc.setTextColor(255, 24, 0);
      doc.text('Balance at Workshop:', 120, currentY + 40);
      doc.text(`$${balanceDue.toFixed(2)} NZD`, 165, currentY + 40);
    }

    // Left block of financial: secure clearance badge
    doc.setFillColor(255, 24, 0, 0.04);
    doc.rect(15, currentY + 8, 92, 42, 'F');
    doc.setDrawColor(255, 24, 0, 0.15);
    doc.rect(15, currentY + 8, 92, 42, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 24, 0);
    doc.text('SECURED CLEARANCE', 20, 16 + currentY);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text('This booking is verified and prepaid through Torqued.', 20, 23 + currentY);
    doc.text('Arrive at your scheduled drop-off time and present this', 20, 27 + currentY);
    doc.text('receipt to your workshop on arrival.', 20, 31 + currentY);
    
    // 7. Sign-Off
    const signY = currentY + 62;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, signY, 195, signY);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('Helvetica', 'bold');
    doc.text('AUTHORISED DIGITAL RECEIPT', 15, signY + 8);
    doc.setFont('Helvetica', 'normal');
    doc.text('Generated by Torqued • torquedapp.nz@gmail.com • 022 389 5249', 15, signY + 13);

    // 8. Legal and Footer fineprint
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    const lineY = signY + 24;
    doc.text('Disclaimer: Torqued operates secure, fully encrypted payments matching NZ CAN-SPAM and PCI-DSS compliance requirements.', 15, lineY);
    doc.text('All rates include 15% New Zealand Goods and Services Tax (GST). Present this PDF to your workshop mechanic upon arrival.', 15, lineY + 4);

    doc.save(`Torqued-Secure-Booking-${job.id.toUpperCase()}.pdf`);
  };
  const [step, setStep] = useState(1);
  const [rego, setRego] = useState('');
  const [isSearchingRego, setIsSearchingRego] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mileage, setMileage] = useState<string>('');
  const [quotePath, setQuotePath] = useState<'service' | 'fault' | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [faultCode, setFaultCode] = useState('');
  const [aiTranslation, setAiTranslation] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('10km');
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [paymentOption, setPaymentOption] = useState<'full' | 'deposit'>('full');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [view, setView] = useState<'quote' | 'dashboard'>('quote');
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [isEditingDate, setIsEditingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [userServiceItems, setUserServiceItems] = useState<UserServiceItem[]>([
    { id: '1', name: 'WOF Inspection', lastDoneDate: '2025-05-10', intervalMonths: 12 },
    { id: '2', name: 'Timing Belt', lastDoneMileage: 0, intervalMileage: 120000 },
  ]);
  const [isAddingServiceItem, setIsAddingServiceItem] = useState(false);
  const [newServiceItemName, setNewServiceItemName] = useState('');
  const [newServiceItemMileage, setNewServiceItemMileage] = useState('');
  const [suggestedJobs, setSuggestedJobs] = useState<string[]>([]);

  // Scheduling state
  const [selectedDate, setSelectedDate] = useState<string>('2026-04-23'); // Default to Thursday (2 days from Tuesday)
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [estimatedReadyTime, setEstimatedReadyTime] = useState<string>('5:00 PM');
  
  // New user / history state
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseMileage, setPurchaseMileage] = useState('');
  const [manualHistory, setManualHistory] = useState<{date: string, service: string, provider: string, mileage?: string, price?: string, notes?: string}[]>([]);
  const [showHistoryEntry, setShowHistoryEntry] = useState(false);
  const [entryDate, setEntryDate] = useState('');
  const [entryService, setEntryService] = useState('');
  const [entryProvider, setEntryProvider] = useState('');
  const [entryMileage, setEntryMileage] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [isParsingReceipt, setIsParsingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  // Multi-file drag-and-drop service-history import
  type ParsedRecord = { id: string; date: string; service: string; provider: string; mileage: string; price: string; notes: string; fileName: string };
  const [parsedBatch, setParsedBatch] = useState<ParsedRecord[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [showBatchReview, setShowBatchReview] = useState(false);
  const [isDiagnosticMode, setIsDiagnosticMode] = useState(false);
  const [diagnosticComment, setDiagnosticComment] = useState('');
  const [isDiagnosticSimulatedComplete, setIsDiagnosticSimulatedComplete] = useState(false);
  const [isRepairFromDiagnostic, setIsRepairFromDiagnostic] = useState(false);
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [hasMBI, setHasMBI] = useState(false);
  const [mbiStatus, setMbiStatus] = useState<'none' | 'pre-approved' | 'not-claimed'>('none');
  const [claimNumber, setClaimNumber] = useState('');
  const [dob, setDob] = useState('');
  const [isRAH190, setIsRAH190] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isClaimApproved, setIsClaimApproved] = useState(false);

  // Verification states for registered plates
  const [showVerificationRequired, setShowVerificationRequired] = useState(false);
  const [verifiedEmailTarget, setVerifiedEmailTarget] = useState<string | null>(null);
  const [plateMatchError, setPlateMatchError] = useState<string | null>(null);

  // New customer registration
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [returningCustomerName, setReturningCustomerName] = useState<string | null>(null);
  // The customer's real email (from onboarding/verification) — used for Stripe checkout
  const [customerEmail, setCustomerEmail] = useState<string>('');
  // Per-vehicle service pricing loaded from the DB for the active vehicle
  const [vehiclePrices, setVehiclePrices] = useState<Record<string, number>>({});
  // Vehicle oil spec (from vehicle_specs) — used to calculate mechanic package price for this vehicle
  const [vehicleOilCapacity, setVehicleOilCapacity] = useState<number | null>(null);
  const [vehicleOilType, setVehicleOilType] = useState<string | null>(null);
  // Mechanic's service packages fetched when a mechanic is selected
  const [mechanicPackages, setMechanicPackages] = useState<any[]>([]);
  // The customer's garage — all vehicles on their account
  const [garageVehicles, setGarageVehicles] = useState<Vehicle[]>([]);
  const [customerOwnerId, setCustomerOwnerId] = useState<string | null>(null);
  // ── My Garage session gate: verified via passkey or magic link, valid 48h, this browser only ──
  const SESSION_KEY = 'torqued_customer_session';
  const SESSION_TTL = 48 * 60 * 60 * 1000;
  const [customerVerifiedAt, setCustomerVerifiedAt] = useState<number | null>(null);
  const garageUnlocked = customerVerifiedAt != null && (Date.now() - customerVerifiedAt) < SESSION_TTL;
  const persistCustomerSession = (s: { ownerId: string | null; email: string; rego: string; vehicles: any[] }) => {
    const at = Date.now();
    setCustomerVerifiedAt(at);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, verifiedAt: at })); } catch {}
  };
  const clearCustomerSession = () => {
    setCustomerVerifiedAt(null); setCustomerOwnerId(null); setCustomerEmail(''); setGarageVehicles([]);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  };
  // Real mechanics from the DB (so bookings route to a real mechanic account)
  const [realMechanics, setRealMechanics] = useState<Mechanic[]>([]);

  // Fleet quote lookup state (vehicle_models + parts_data)
  const [fleetQuoteState, setFleetQuoteState] = useState<'loading' | 'instant' | 'fallback' | null>(null);
  const [fleetQuoteRange, setFleetQuoteRange] = useState<{ low: number; high: number } | null>(null);
  const [fleetVehicleId, setFleetVehicleId] = useState<string | null>(null);
  const [carjamVehicle, setCarjamVehicle] = useState<{ make: string; model: string; year: number; bodyType: string; fuel: string } | null>(null);
  const [quoteFallbackCategoryId, setQuoteFallbackCategoryId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/mechanics')
      .then(r => r.json())
      .then(d => {
        const mapped: Mechanic[] = (d.mechanics || []).map((m: any) => ({
          id: m.id,                       // real account UUID — bookings route here
          name: m.name || 'Workshop',
          logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || 'W')}&background=FF1800&color=fff&bold=true`,
          suburb: m.address ? String(m.address).split(',').slice(-1)[0].trim() : 'NZ',
          address: m.address || undefined,
          distance: 1.2,
          rating: m.rating || 5.0,
          reviews: m.review_count || 0,
          labourRate: m.labour_rate || undefined,
          specialisations: ['General Service', 'Diagnostics'],
          nextAvailable: 'Tomorrow, 8am',
          isFeatured: true,
          estimatedPrice: 0,
          technicians: m.technicians || 1,
          partsLeadDays: m.parts_lead_days ?? 1,
          latitude: m.latitude ?? undefined,
          longitude: m.longitude ?? undefined,
        }));
        setRealMechanics(mapped);
      })
      .catch(() => {});
  }, []);

  // Consumer location for distance-based mechanic search (Google/device location services)
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAsked, setLocationAsked] = useState(false);

  // ── Customer AI assistant (diagnostic + maintenance chat) ──
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string; image?: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatPhoto, setChatPhoto] = useState<string | null>(null);
  const chatStarters = [
    'When are my spark plugs due?',
    'Grinding noise when I brake — what is it?',
    'My car is overdue a service, what do I need?',
    'A warning light is on — is it safe to drive?',
  ];
  const sendChat = async (text: string, photo?: string | null) => {
    const t = text.trim();
    const img = photo ?? chatPhoto;
    if (!t && !img || chatBusy) return;
    const userMsg: { role: 'user'; text: string; image?: string } = { role: 'user', text: t || 'What can you see in this photo?' };
    if (img) userMsg.image = img;
    const next = [...chatMessages, userMsg];
    setChatMessages(next);
    setChatInput('');
    setChatPhoto(null);
    setChatBusy(true);
    try {
      const res = await fetch('/api/ai/customer-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.text, ...(m.image ? { image: m.image } : {}) })),
          ownerId: customerOwnerId, rego: vehicle?.rego,
          lat: customerCoords?.lat, lng: customerCoords?.lng,
        }),
      });
      const d = await res.json();
      setChatMessages(m => [...m, { role: 'assistant', text: res.ok ? (d.reply || 'Sorry, I could not answer that.') : (d.error || 'Assistant unavailable.') }]);
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', text: 'The assistant is unavailable right now. Please try again.' }]);
    } finally {
      setChatBusy(false);
    }
  };
  const requestLocation = () => {
    setLocationAsked(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setCustomerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* denied — fall back to showing all mechanics */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371, toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
  };
  // Mechanics with a real distance from the consumer (when location known)
  const mechanicsByDistance = useMemo(() => {
    if (!customerCoords) return realMechanics;
    return realMechanics
      .map(m => (m.latitude != null && m.longitude != null)
        ? { ...m, distance: haversineKm(customerCoords, { lat: m.latitude, lng: m.longitude }) }
        : m)
      .sort((a, b) => a.distance - b.distance);
  }, [realMechanics, customerCoords]);

  // OTP Verification States
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSentEmail, setOtpSentEmail] = useState('');
  const [otpVerificationError, setOtpVerificationError] = useState('');
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpResendMsg, setOtpResendMsg] = useState<string | null>(null);
  // Magic-link verification state
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);
  const [magicFallbackLink, setMagicFallbackLink] = useState<string | null>(null);
  const [magicVerifying, setMagicVerifying] = useState(false);

  // Restore a recent (≤48h) verified session on this browser
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.verifiedAt && (Date.now() - s.verifiedAt) < SESSION_TTL) {
        setCustomerVerifiedAt(s.verifiedAt);
        if (s.ownerId) setCustomerOwnerId(s.ownerId);
        if (s.email) setCustomerEmail(s.email);
        if (Array.isArray(s.vehicles) && s.vehicles.length) {
          setGarageVehicles(s.vehicles.map((r: any) => ({ id: r.rego, rego: r.rego, make: r.make, model: r.model, year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0, thumbnail: r.thumbnail ?? undefined })));
        }
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }, []);

  // Load ALL of this customer's real bookings (multiple jobs, persistent across refresh)
  const loadCustomerBookings = async () => {
    const regos = garageVehicles.map(g => g.rego).filter(Boolean);
    if (!customerOwnerId && regos.length === 0) return;
    try {
      const qs = new URLSearchParams();
      if (customerOwnerId) qs.set('ownerId', customerOwnerId);
      if (regos.length) qs.set('regos', regos.join(','));
      const res = await fetch(`/api/customer/bookings?${qs.toString()}`);
      const { bookings } = await res.json();
      if (!Array.isArray(bookings)) return;
      const mapped: Job[] = bookings
        .filter((r: any) => !['cancelled', 'declined'].includes(r.status))
        .map((r: any) => ({
          id: r.id, vehicleId: r.vehicle_rego || '', serviceIds: r.service_ids || [],
          mechanicId: r.mechanic_id || '', status: r.status || 'booked',
          paymentStatus: r.payment_status === 'confirmed' ? 'confirmed' : 'pending',
          paymentMethod: r.payment_method || '', date: r.date || '',
          totalPrice: parseFloat(r.total_price) || 0, depositPaid: r.deposit_paid ?? undefined,
          description: r.description || undefined, customerName: r.customer_name || undefined,
          email: r.email || undefined, phone: r.phone || undefined,
        }));
      setActiveJobs(mapped);
    } catch { /* keep local jobs */ }
  };
  useEffect(() => { if (garageUnlocked) loadCustomerBookings(); /* eslint-disable-next-line */ }, [garageUnlocked, customerOwnerId, garageVehicles.length]);

  // Verify a magic link on load (?vt=token)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vt = params.get('vt');
    if (!vt) return;
    setMagicVerifying(true);
    window.history.replaceState({}, document.title, window.location.pathname);
    fetch(`/api/customer/verify-link?token=${encodeURIComponent(vt)}`)
      .then(r => r.json())
      .then(async (d) => {
        if (!d.success) { setPlateMatchError(d.error || 'Link invalid or expired.'); return; }
        if (d.email) setCustomerEmail(d.email);
        if (d.ownerId) setCustomerOwnerId(d.ownerId);
        if (Array.isArray(d.vehicles) && d.vehicles.length) {
          setGarageVehicles(d.vehicles.map((r: any) => ({ id: r.rego, rego: r.rego, make: r.make, model: r.model, year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0, thumbnail: r.thumbnail ?? undefined })));
        }
        setRego(d.rego);
        persistCustomerSession({ ownerId: d.ownerId ?? null, email: d.email ?? '', rego: d.rego, vehicles: d.vehicles ?? [] });
        setView('dashboard');
        await loadVehicleByRego(d.rego);
      })
      .catch(() => setPlateMatchError('Verification failed. Please try again.'))
      .finally(() => setMagicVerifying(false));
  }, []);
  // QR deep-link → review-and-pay with the mechanic's quote pre-loaded
  const [quoteReview, setQuoteReview] = useState<any | null>(null);
  const [quotePaying, setQuotePaying] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qid = params.get('quote');
    if (!qid) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    fetch(`/api/quote/${encodeURIComponent(qid)}`).then(r => r.json()).then(d => { if (d && d.id) setQuoteReview(d); }).catch(() => {});
  }, []);
  const payQuote = async () => {
    if (!quoteReview) return;
    setQuotePaying(true);
    try {
      const res = await fetch('/api/stripe/create-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: quoteReview.total, bookingId: quoteReview.id, customerEmail: customerEmail || undefined, description: `Torqued quote ${quoteReview.id}` }),
      });
      const session = await res.json();
      if (session?.url) { window.location.href = session.url; return; }
      setQuotePaying(false);
    } catch { setQuotePaying(false); }
  };

  // Verify a returning customer with a passkey (Face/Touch ID). Magic link remains the fallback.
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyCardState, setPasskeyCardState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const verifyWithPasskey = async (plate: string) => {
    setPasskeyError(null);
    setMagicVerifying(true);
    try {
      const r = await authPasskey('customer', plate);
      if (r.email) setCustomerEmail(r.email);
      if (r.ownerId) setCustomerOwnerId(r.ownerId);
      if (Array.isArray(r.vehicles) && r.vehicles.length) {
        setGarageVehicles(r.vehicles.map((v: any) => ({ id: v.rego, rego: v.rego, make: v.make, model: v.model, year: v.year, variant: v.variant ?? undefined, mileage: v.mileage ?? 0, thumbnail: v.thumbnail ?? undefined })));
      }
      setRego((r.rego || plate));
      persistCustomerSession({ ownerId: r.ownerId ?? null, email: r.email ?? '', rego: r.rego || plate, vehicles: r.vehicles ?? [] });
      setMagicSentTo(null);
      setView('dashboard');
      await loadVehicleByRego(r.rego || plate);
    } catch (e: any) {
      setPasskeyError(e?.message || 'Passkey sign-in failed — use the email link instead.');
    } finally {
      setMagicVerifying(false);
    }
  };

  // First booking → offer to create a passkey for faster future logins
  const [pkPrompted, setPkPrompted] = useState(false);
  useEffect(() => {
    if (step !== 7) return;
    const plate = (rego || vehicle?.rego || '').toUpperCase();
    if (!plate) return;
    // Booking + payment proves ownership → grant a 48h garage session
    if (!garageUnlocked) {
      persistCustomerSession({ ownerId: customerOwnerId, email: customerEmail, rego: plate, vehicles: garageVehicles });
    }
    if (pkPrompted || !passkeysSupported()) return;
    setPkPrompted(true);
    const t = setTimeout(async () => {
      try {
        if (window.confirm('Booking confirmed! 🎉\n\nWant faster access next time? Create a passkey to sign in with Face ID / Touch ID — no email link needed.')) {
          await registerPasskey('customer', plate);
          window.alert('Passkey created. Next time you enter your plate, just tap "Verify with Face / Touch ID".');
        }
      } catch { /* cancelled — magic link still works */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [step, pkPrompted, rego, vehicle]);

  // Review flow (opened from the review link in the completion email)
  const [reviewCtx, setReviewCtx] = useState<{ bookingId: string; mechanicId: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rb = params.get('review_booking');
    const m = params.get('m');
    if (rb && m) {
      setReviewCtx({ bookingId: rb, mechanicId: m });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [isStripeSessionLoading, setIsStripeSessionLoading] = useState(false);
  const [stripeSessionError, setStripeSessionError] = useState<string | null>(null);
  const [stripeIsMock, setStripeIsMock] = useState(false);

  // New state to tracking the last booked job for dynamic Step 7 messaging
  const [latestBooking, setLatestBooking] = useState<Job | null>(null);

  // Promo Code and Email confirmation states
  
  const [emittedEmailHtml, setEmittedEmailHtml] = useState<string | null>(null);
  const [emittedMechanicHtml, setEmittedMechanicHtml] = useState<string | null>(null);
  const [emittedDropoffHtml, setEmittedDropoffHtml] = useState<string | null>(null);
  const [emittedServiceReminderHtml, setEmittedServiceReminderHtml] = useState<string | null>(null);
  const [emittedSmsText, setEmittedSmsText] = useState<string | null>(null);

  const [showEmailModal, setShowEmailModal] = useState(false);

  // Email Sandbox UI states
  const [selectedEmailTab, setSelectedEmailTab] = useState<'customer' | 'mechanic' | 'dropoff' | 'service' | 'sms'>('customer');
  const [testEmailAddress, setTestEmailAddress] = useState('sri.140nz@gmail.com');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendStatus, setTestSendStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [testSendStatusMsg, setTestSendStatusMsg] = useState('');

  const triggerEmailConfirmation = async (job: any) => {
    try {
      const mechanic = MOCK_MECHANICS.find(m => m.id === job.mechanicId) || selectedMechanic || MOCK_MECHANICS[0];
      const serviceNames = job.serviceIds.map((id: string) => SERVICES.find(s => s.id === id)?.name || id);
      
      const payload = {
        email: job.email || userProfile?.email || user?.email || 'customer@torqued.nz',
        customerName: userProfile?.name || cardName || 'Valued Customer',
        bookingId: job.id,
        date: job.date,
        time: selectedTime || '09:00 AM',
        readyTime: estimatedReadyTime || '04:30 PM',
        vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Volkswagen Golf GTE',
        plate: vehicle?.plate || 'RAH190',
        mechanicName: mechanic?.name || 'R&D European',
        mechanicAddress: mechanic?.address || 'your mechanics address',
        paymentMethod: job.paymentMethod || 'Credit / Debit',
        services: serviceNames,
        price: job.totalPrice,
        paymentOption: paymentOption,
        depositPaid: job.depositPaid,


      };

      const res = await fetch('/api/email/confirm-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.html) setEmittedEmailHtml(result.html);
        if (result.mechanicHtml) setEmittedMechanicHtml(result.mechanicHtml);
        if (result.dropoffHtml) setEmittedDropoffHtml(result.dropoffHtml);
        if (result.serviceReminderHtml) setEmittedServiceReminderHtml(result.serviceReminderHtml);
        if (result.smsText) setEmittedSmsText(result.smsText);
      }
    } catch (err) {
      console.error('Trigger confirmation mail error:', err);
    }
  };

  const handleSendTestSingle = async () => {
    if (!testEmailAddress) {
      setTestSendStatus('failed');
      setTestSendStatusMsg('Recipient email is required.');
      return;
    }
    
    setIsSendingTest(true);
    setTestSendStatus('idle');
    setTestSendStatusMsg('');
    
    try {
      const servicesArray = latestBooking 
        ? latestBooking.serviceIds.map(id => SERVICES.find(s => s.id === id)?.name || id)
        : selectedServices.map(id => SERVICES.find(s => s.id === id)?.name || id);

      const payload = {
        recipient: testEmailAddress,
        templateType: selectedEmailTab,
        bookingData: {
          customerName: userProfile?.name || cardName || 'Sri Test Owner',
          bookingId: latestBooking?.id || 'TQ-TEST-998A',
          date: latestBooking?.date || selectedDate,
          time: selectedTime || '09:00 AM',
          readyTime: estimatedReadyTime || '04:30 PM',
          vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Volkswagen Golf GTE',
          plate: vehicle?.rego || 'RAH190',
          mechanicName: selectedMechanic?.name || 'your selected mechanic',
          mechanicAddress: selectedMechanic?.address || 'your mechanics address',
          paymentMethod: latestBooking?.paymentMethod || paymentMethod || 'Credit / Debit',
          services: servicesArray.length > 0 ? servicesArray : ['Full Dual-Clutch Transmission (DCT) Service & Calibration'],
          price: latestBooking?.totalPrice || 349.00,
          paymentOption: paymentOption,
          depositPaid: latestBooking?.depositPaid || 0,
  
  
        }
      };

      const res = await fetch('/api/email/send-test-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.sentRealEmail) {
          setTestSendStatus('success');
          setTestSendStatusMsg(`Successfully dispatched LIVE SMTP email directly to ${testEmailAddress}! Check your inbox!`);
        } else if (result.smtpError) {
          setTestSendStatus('failed');
          setTestSendStatusMsg(`SMTP CONFIG ERROR: Direct dispatch failed. The mail server responded: "${result.smtpError}". Please verify host port, TLS protocol, and authentication logins.`);
        } else {
          setTestSendStatus('success');
          setTestSendStatusMsg(`SIMULATED: Fallback log printed in terminal! SMTP credentials not configured yet, but template generated successfully!`);
        }
      } else {
        const errJson = await res.json();
        setTestSendStatus('failed');
        setTestSendStatusMsg(errJson.error || 'Failed to dispatch test email.');
      }
    } catch (e) {
      console.error(e);
      setTestSendStatus('failed');
      setTestSendStatusMsg(e instanceof Error ? e.message : 'Failed to connect to backend server endpoint.');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Automatically fetch rendered email templates when the email sandbox modal is loaded
  useEffect(() => {
    if (showEmailModal && latestBooking) {
      triggerEmailConfirmation(latestBooking);
    }
  }, [showEmailModal, latestBooking]);

  // Custom Embedded Stripe states
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [stripeFormStep, setStripeFormStep] = useState<'input' | 'processing' | 'success'>('input');
  const [stripeLoadingMessage, setStripeLoadingMessage] = useState('Initiating payment... Please wait.');
  const [stripeInputEmail, setStripeInputEmail] = useState('');
  const [stripeInputPhone, setStripeInputPhone] = useState('');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardPostalCode, setCardPostalCode] = useState('');
  const [cardError, setCardError] = useState('');

  const DUMMY_PROVIDERS = ["RD European", "ATS Cumberland", "Precision Mechanical", "Anthony Motors", "Dave Ward Mechanical"];
  const filteredProviders = entryProvider.length > 0 
    ? DUMMY_PROVIDERS.filter(p => p.toLowerCase().includes(entryProvider.toLowerCase()) && p !== entryProvider)
    : [];

  // Suggest jobs based on mileage and vehicle type
  useEffect(() => {
    const km = parseInt(mileage);
    if (!km) return;

    const suggestions: string[] = [];
    const isEV = vehicle?.make === 'Tesla';

    if (km > 90000 && km < 120000 && !isEV) {
      suggestions.push('timing'); // Cambelt due
      suggestions.push('transmission'); // DCT service
    }

    if (km > 200000 && vehicle?.make === 'Toyota') {
      suggestions.push('full'); // Major service
      suggestions.push('battery'); // Old car battery
    }
    
    if (isEV) {
      if (km > 100000) {
        suggestions.push('cabin_filter');
        suggestions.push('brake_fluid');
      }
    } else {
      if (km % 10000 < 1000) {
        suggestions.push('oil');
      }
    }

    setSuggestedJobs(suggestions);
  }, [mileage, vehicle]);

  // Listen for Stripe sessions and handle verification login defaults
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const bookingId = params.get('booking_id');
    if (sessionId && bookingId) {
      const initPaymentVerification = async () => {
        const savedPending = localStorage.getItem('pending_booking');
        if (savedPending) {
          try {
            const booking = JSON.parse(savedPending);
            
            // Retrieve customer details from Stripe checkout session
            let customerEmailStr = '';
            let customerNameStr = '';
            let customerPhoneStr = '';
            try {
              const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
              if (res.ok) {
                const data = await res.json();
                if (data.status === 'succeeded') {
                  if (data.email) customerEmailStr = data.email;
                  if (data.name) customerNameStr = data.name;
                  if (data.phone) customerPhoneStr = data.phone;
                }
              }
            } catch (err) {
              console.error('Verify session api call failed:', err);
            }

            booking.paymentStatus = 'confirmed';
            booking.status = 'booked';
            if (customerEmailStr) booking.email = customerEmailStr;
            if (customerNameStr) booking.customerName = customerNameStr;
            if (customerPhoneStr) booking.phone = customerPhoneStr;
            
            // Update profiling with collected details
            if (updateProfile) {
              updateProfile({ 
                email: customerEmailStr || undefined,
                name: customerNameStr || undefined,
                phone: customerPhoneStr || undefined
              });
            }
            
            setActiveJobs(prev => [...prev, booking]);
            setLatestBooking(booking);
            setStep(7); // Jump straight to confirmed step!
            setView('quote');
            
            // Trigger confirmation email
            await triggerEmailConfirmation(booking);
            
            // Clear URL query parameters for a clean experience
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (err) {
            console.error('Stripe response processing failure:', err);
          }
        }
      };
      
      initPaymentVerification();
    }
  }, []);

  // Update details when auth profiles stream
  useEffect(() => {
    if (userProfile) {
      setUserName(userProfile.name);
      if (userProfile.homeLocation) {
        setLocation(userProfile.homeLocation);
      }
    }
  }, [userProfile]);

  // Load persisted bookings from Supabase when user is available
  useEffect(() => {
    if (!user) return;
    supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('Failed to load bookings:', error.message); return; }
        if (!data || data.length === 0) return;
        const loaded: Job[] = data.map((row: any) => ({
          id: row.id,
          vehicleId: row.vehicle_rego || '',
          serviceIds: row.service_ids || [],
          mechanicId: row.mechanic_id,
          status: row.status,
          paymentStatus: row.payment_status,
          paymentMethod: row.payment_method || '',
          date: row.date || '',
          totalPrice: parseFloat(row.total_price) || 0,
          depositPaid: row.deposit_paid != null ? parseFloat(row.deposit_paid) : undefined,
          customerName: row.customer_name || undefined,
          email: row.email || undefined,
          phone: row.phone || undefined,
        }));
        // Merge: DB is source of truth; keep any in-memory bookings not yet written to DB
        setActiveJobs(prev => {
          const dbIds = new Set(loaded.map(j => j.id));
          const localOnly = prev.filter(j => !dbIds.has(j.id));
          return [...loaded, ...localOnly];
        });
      });
  }, [user]);

  // OTP resend cooldown ticker
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setInterval(() => setOtpResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [otpResendCooldown]);

  // Price for a service on the ACTIVE vehicle: use the vehicle's real DB pricing
  // (vehicle_specs.service_prices) when available, else fall back to the generic base.
  const priceFor = (id: string) => {
    const v = vehiclePrices[id];
    if (typeof v === 'number' && v > 0) return v;
    return SERVICES.find(s => s.id === id)?.basePrice || 0;
  };

  // Calculate total price based on selected services (per-vehicle pricing)
  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, id) => sum + priceFor(id), 0);
  }, [selectedServices, vehiclePrices]);

  const handleConfirmOTP = async () => {
    if (otpCode.trim().length !== 6) {
      setOtpVerificationError('Verification code must be exactly 6 digits.');
      return;
    }
    const formattedRego = rego.toUpperCase().trim();

    // Verify OTP server-side before unlocking vehicle data
    try {
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego: formattedRego, code: otpCode.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        setOtpVerificationError(verifyData.error || 'Invalid or expired code. Please try again.');
        return;
      }
      if (verifyData.email) setCustomerEmail(verifyData.email);
      if (verifyData.ownerId) setCustomerOwnerId(verifyData.ownerId);
      if (Array.isArray(verifyData.vehicles) && verifyData.vehicles.length) {
        setGarageVehicles(verifyData.vehicles.map((r: any) => ({
          id: r.rego, rego: r.rego, make: r.make, model: r.model,
          year: r.year, variant: r.variant ?? undefined, mileage: r.mileage ?? 0,
          thumbnail: r.thumbnail ?? undefined,
        })));
      }
    } catch {
      setOtpVerificationError('Verification failed. Please try again.');
      return;
    }

    await loadVehicleByRego(formattedRego);
    setShowOTPModal(false);
    setOtpCode('');
    setOtpVerificationError('');
  };

  const loadVehicleByRego = async (rego: string) => {
    try {
      const res = await fetch(`/api/vehicles/${rego}`);
      if (!res.ok) throw new Error('Vehicle not found');
      const data = await res.json();
      const v: Vehicle = {
        id: data.rego,
        rego: data.rego,
        make: data.make,
        model: data.model,
        year: data.year,
        variant: data.variant ?? undefined,
        mileage: data.mileage ?? 0,
        thumbnail: data.thumbnail ?? undefined,
      };
      setVehicle(v);
      setMileage((data.mileage ?? 0).toString());
      setIsRAH190(rego === 'RAH190');
      setUserName(userProfile?.name || null);
      // Per-vehicle service pricing and oil specs from the DB
      const specs = Array.isArray(data.vehicle_specs) ? data.vehicle_specs[0] : data.vehicle_specs;
      // Start with any legacy vehicle_specs.service_prices, then overlay fleet DB midpoints
      const legacyPrices: Record<string, number> = specs?.service_prices || {};
      setVehiclePrices(legacyPrices);
      setVehicleOilCapacity(specs?.oil_capacity_litres ?? null);
      setVehicleOilType(specs?.oil_type ?? null);
      // Fetch fleet prices in background and overlay onto vehiclePrices so the
      // Step 2 tally and Step 4 mechanic list reflect real parts_data midpoints.
      fetch(`/api/fleet-prices?rego=${encodeURIComponent(rego)}`)
        .then(r => r.json())
        .then((fp: { prices: Record<string, { low: number; high: number; midpoint: number }> }) => {
          if (fp?.prices && Object.keys(fp.prices).length > 0) {
            const fleetMidpoints: Record<string, number> = {};
            for (const [svcId, p] of Object.entries(fp.prices)) {
              fleetMidpoints[svcId] = p.midpoint;
            }
            // Fleet midpoints win over legacy — they're vehicle-specific real data
            setVehiclePrices({ ...legacyPrices, ...fleetMidpoints });
          }
        })
        .catch(() => {/* fleet prices are best-effort */});
      // Load any saved/imported service history for this vehicle
      if (Array.isArray(data.history) && data.history.length) {
        setManualHistory(data.history.map((h: any) => ({
          date: h.service_date || '', service: h.work_done || '', provider: h.provider || '',
          mileage: h.mileage != null ? String(h.mileage) : '', price: h.price || '', notes: h.notes || '',
        })));
      }
      // Ensure this car is in the garage list
      setGarageVehicles(prev => prev.some(g => g.rego === v.rego) ? prev : [...prev, v]);
      if (user) {
        try { await registerVehicle(v); } catch {}
      }
    } catch {
      // Fallback if API unavailable
      setVehicle({ id: rego, rego, make: 'Unknown', model: 'Vehicle', year: 2020, mileage: 0 });
      setMileage('0');
    }
  };

  // ── Fleet quote lookup (vehicle_models + parts_data) ──────────────────────

  // Maps SERVICES ids to part_categories slugs in migration 018.
  const SERVICE_TO_CATEGORY_SLUG: Record<string, string> = {
    oil: 'oil_filter',
    timing: 'cambelt',
    brakes_front_pads: 'front_brake_pads',
    brakes_front_rotors: 'front_rotors',
    brakes_rear_pads: 'rear_brake_pads',
    brakes_rear_rotors: 'rear_rotors',
    battery: 'battery_12v',
    spark_plugs: 'ignition_coils',
    cabin_filter: 'cabin_air_filter',
    transmission: 'transmission_filter',
  };

  // Stub Carjam API call — hardcoded sample. Wire real API key separately.
  const stubCarjamLookup = (_plate: string) => ({
    make: 'TOYOTA', model: 'COROLLA', year: 2015, bodyType: 'sedan', fuel: 'petrol',
  });

  const lookupFleetQuote = async () => {
    setFleetQuoteState('loading');
    setFleetQuoteRange(null);
    setFleetVehicleId(null);
    setQuoteFallbackCategoryId(null);
    try {
      const carjam = stubCarjamLookup(rego);
      setCarjamVehicle(carjam);

      // 1. Find vehicle match via vehicle_aliases
      const { data: aliases } = await supabase
        .from('vehicle_aliases')
        .select('vehicle_id, vehicle_models(body_type, fuel)')
        .ilike('alias_make', carjam.make)
        .ilike('alias_model', carjam.model)
        .limit(1);

      if (!aliases || aliases.length === 0) {
        await _resolveSegmentFallback(null, null, carjam, null);
        return;
      }

      const matchedId = aliases[0].vehicle_id;
      setFleetVehicleId(matchedId);
      const vmData = (aliases[0] as any).vehicle_models as { body_type?: string; fuel?: string } | null;

      // 2. Find first selected service with a category mapping
      const firstSlug = selectedServices.map(id => SERVICE_TO_CATEGORY_SLUG[id]).find(Boolean);
      if (!firstSlug) { setFleetQuoteState(null); return; }

      const { data: cat } = await supabase
        .from('part_categories').select('id').eq('slug', firstSlug).single();
      if (!cat) { await _resolveSegmentFallback(matchedId, vmData, carjam, null); return; }

      const catId: number = cat.id;
      setQuoteFallbackCategoryId(catId);

      // 3. Check parts_data
      const { data: pd } = await supabase
        .from('parts_data')
        .select('part_cost_low, part_cost_high, source, confidence')
        .eq('vehicle_id', matchedId)
        .eq('category_id', catId)
        .single();

      if (!pd) { await _resolveSegmentFallback(matchedId, vmData, carjam, catId); return; }
      if (pd.source === 'ai_seed' && pd.confidence <= 1) {
        await _resolveSegmentFallback(matchedId, vmData, carjam, catId); return;
      }

      // Instant quote path
      setFleetQuoteRange({ low: Number(pd.part_cost_low), high: Number(pd.part_cost_high) });
      setFleetQuoteState('instant');
    } catch {
      setFleetQuoteState(null);
    }
  };

  const _resolveSegmentFallback = async (
    matchedVehicleId: string | null,
    vmData: { body_type?: string; fuel?: string } | null,
    carjam: { make: string; model: string; year: number; bodyType: string; fuel: string },
    catId: number | null,
  ) => {
    let rangeLow = 150;
    let rangeHigh = 2500;
    try {
      if (catId !== null) {
        const bodyType = vmData?.body_type ?? carjam.bodyType;
        const fuel = vmData?.fuel ?? carjam.fuel;
        const { data: segVehicles } = await supabase
          .from('vehicle_models').select('id').eq('body_type', bodyType).eq('fuel', fuel);
        const ids = (segVehicles ?? []).map((v: any) => v.id);
        if (ids.length > 0) {
          const { data: prices } = await supabase
            .from('parts_data').select('part_cost_low, part_cost_high')
            .in('vehicle_id', ids).eq('category_id', catId);
          if (prices && prices.length > 0) {
            const avgL = prices.reduce((s: number, r: any) => s + Number(r.part_cost_low), 0) / prices.length;
            const avgH = prices.reduce((s: number, r: any) => s + Number(r.part_cost_high), 0) / prices.length;
            rangeLow = Math.round(avgL / 50) * 50 || 150;
            rangeHigh = Math.round(avgH / 50) * 50 || 2500;
          }
        }
      }
    } catch {}
    setFleetQuoteRange({ low: rangeLow, high: rangeHigh });
    setFleetQuoteState('fallback');

    // Insert quote_requests row + call edge function stub
    try {
      const { data: row } = await supabase
        .from('quote_requests')
        .insert({
          vehicle_id: matchedVehicleId,
          carjam_plate: rego.toUpperCase(),
          carjam_make: carjam.make,
          carjam_model: carjam.model,
          carjam_year: carjam.year,
          category_id: catId,
          customer_email: customerEmail || 'unknown@pending.nz',
          customer_name: userName || returningCustomerName || null,
          range_low: rangeLow,
          range_high: rangeHigh,
        })
        .select('id')
        .single();
      if (row?.id) {
        supabase.functions.invoke('handle_manual_quote_request', {
          body: { quoteRequestId: row.id, plate: rego, make: carjam.make, model: carjam.model, rangeLow, rangeHigh },
        }).catch(() => {});
      }
    } catch {}
  };

  // Switch the active vehicle in the garage (loads its specs/pricing + history)
  const selectGarageVehicle = async (rego: string) => {
    await loadVehicleByRego(rego);
    setView('quote');
  };

  // ── Active-job cancellation + reschedule (uses the shared backend policy/refund engine) ──
  const [jobDetail, setJobDetail] = useState<Record<string, any>>({});   // bookingId → detail
  const [jobBusy, setJobBusy] = useState<string | null>(null);
  const [reschedJob, setReschedJob] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('09:00');
  const RESCHED_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'];

  const loadJobDetail = async (job: Job) => {
    try {
      const r = await fetch(`/api/booking/${job.id}/detail`);
      const d = await r.json();
      if (r.ok) setJobDetail(prev => ({ ...prev, [job.id]: d }));
      return r.ok ? d : null;
    } catch { return null; }
  };

  const cancelJob = async (job: Job) => {
    setJobBusy(job.id);
    try {
      const d = jobDetail[job.id] || await loadJobDetail(job);
      const c = d?.cancellation;
      const policyMsg = c
        ? (c.fullRefund
            ? `You're cancelling with enough notice (policy: ${c.requiredHours}h of open time, excluding weekends/public holidays).\n\nYou'll receive a FULL refund${c.paid ? ` of $${c.refundAmount.toFixed(2)}` : ''}.`
            : `This is short notice — less than ${c.requiredHours}h of open time before drop-off.\n\nPer ${d?.mechanic?.name || 'the workshop'}'s policy you'll be refunded ${c.refundPct}%${c.paid ? ` ($${c.refundAmount.toFixed(2)})` : ''}.`)
        : 'Cancel this booking?';
      if (!window.confirm(`${policyMsg}\n\nConfirm cancellation?`)) { setJobBusy(null); return; }
      const res = await fetch('/api/customer/request-cancellation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: job.id }),
      });
      const out = await res.json();
      if (!res.ok) { alert(out.error || 'Could not cancel.'); setJobBusy(null); return; }
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      alert(out.fullRefund ? `Cancelled — full refund issued${out.refundAmount ? ` ($${out.refundAmount.toFixed(2)})` : ''}.`
                           : `Cancelled — ${out.refundPct}% refund issued${out.refundAmount ? ` ($${out.refundAmount.toFixed(2)})` : ''}.`);
    } finally { setJobBusy(null); }
  };

  const saveReschedule = async (job: Job) => {
    if (!reschedDate) return;
    setJobBusy(job.id);
    try {
      const iso = new Date(`${reschedDate}T${reschedTime}:00`).toISOString();
      const res = await fetch('/api/customer/reschedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: job.id, date: iso }),
      });
      const out = await res.json();
      if (!res.ok) { alert(out.error || 'Could not reschedule.'); return; }
      setActiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, date: iso } : j));
      setReschedJob(null);
    } finally { setJobBusy(null); }
  };

  // Preload booking detail (itemised quote + policy) for each active job.
  useEffect(() => {
    activeJobs.forEach(j => { if (!jobDetail[j.id]) loadJobDetail(j); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobs]);

  // AI-summarised headlines for service-history work (OpenAI here; the iOS app uses on-device Apple AI).
  const [histSummaries, setHistSummaries] = useState<Record<string, string>>({});

  // Vehicle photos
  const [vehiclePhotos, setVehiclePhotos] = useState<{ id: string; photo_url: string; comment: string; uploaded_by: string; created_at: string }[]>([]);
  const [photoComment, setPhotoComment] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    const rego = vehicle?.rego;
    if (!rego || !garageUnlocked) return;
    fetch(`/api/vehicle-photos/${rego}`).then(r => r.json()).then(d => setVehiclePhotos(d.photos || [])).catch(() => {});
  }, [vehicle?.rego, garageUnlocked]);

  const uploadPhoto = async (file: File) => {
    const rego = vehicle?.rego;
    if (!rego || !file) return;
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(file);
      });
      const r = await fetch('/api/vehicle-photos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego, imageBase64: base64, comment: photoComment, uploadedBy: 'customer' }),
      });
      const d = await r.json();
      if (d.photo) { setVehiclePhotos(p => [d.photo, ...p]); setPhotoComment(''); }
    } finally { setPhotoUploading(false); }
  };

  // Load the FULL service history (imported receipts + completed Torqued jobs) for the active vehicle —
  // same source as the iOS app and mechanic side, so the web My Garage now shows it too.
  useEffect(() => {
    const rego = vehicle?.rego;
    if (!rego) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/history/${rego}`);
        const d = await r.json();
        if (cancelled || !r.ok) return;
        const imported = (d.imported || []).map((h: any) => ({
          date: h.service_date || '', service: h.work_done || 'Service', provider: h.provider || 'Customer record',
          mileage: h.mileage != null ? String(h.mileage) : '', price: h.price || '', notes: h.notes || '',
        }));
        const jobs = (d.jobs || []).filter((j: any) => j.status === 'completed').map((j: any) => ({
          date: j.completed_at || j.date || '',
          service: (j.service_ids || []).map((id: string) => SERVICES.find(s => s.id === id)?.name || id).join(', ') || 'Torqued service',
          provider: 'Torqued', mileage: j.mileage_out != null ? String(j.mileage_out) : '', price: '', notes: '',
        }));
        if (imported.length || jobs.length) setManualHistory([...imported, ...jobs]);
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.rego]);

  // Summarise long work descriptions into a short headline ("Cambelt & Water Pump Replaced, Oil & Filter Service").
  useEffect(() => {
    manualHistory.forEach(async (h) => {
      const key = h.service;
      if (!key || key.length < 40 || histSummaries[key]) return;
      try {
        const r = await fetch('/api/ai/summarize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: key, style: 'title' }),
        });
        const d = await r.json();
        if (r.ok && d.summary) setHistSummaries(prev => ({ ...prev, [key]: d.summary }));
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualHistory]);

  // Simulate/Perform Rego Lookup
  const handleReceiptUpload = async (file: File | null) => {
    if (!file) return;
    setReceiptError(null);
    setIsParsingReceipt(true);
    try {
      // Read file as base64 (strip the data: prefix)
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) { setReceiptError(data.error || 'Could not scan receipt.'); return; }

      // Pre-fill the entry form with the extracted details
      if (data.date) setEntryDate(data.date);
      if (data.service) setEntryService(data.service);
      if (data.provider) setEntryProvider(data.provider);
      if (data.mileage) setEntryMileage(String(data.mileage));
      if (data.price) setEntryPrice(data.price);
      setEntryNotes(data.notes ? `${data.notes} (scanned)` : 'Scanned from receipt');
      setShowHistoryEntry(true);
    } catch {
      setReceiptError('Could not read that file. Try a clear photo or PDF.');
    } finally {
      setIsParsingReceipt(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Parse MANY receipts/PDFs at once (drag-and-drop or multi-select) into editable records
  const handleMultiUpload = async (files: File[]) => {
    const list = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (list.length === 0) { setReceiptError('Only images or PDFs are supported.'); return; }
    setReceiptError(null);
    setBatchProgress({ done: 0, total: list.length });
    setShowBatchReview(true);
    const results: ParsedRecord[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch('/api/ai/parse-receipt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, mimeType: file.type }),
        });
        const d = await res.json();
        if (res.ok) {
          results.push({
            id: `${Date.now()}-${i}`, date: d.date || '', service: d.service || '', provider: d.provider || '',
            mileage: d.mileage ? String(d.mileage) : '', price: d.price || '', notes: d.notes || '', fileName: file.name,
          });
        } else {
          results.push({ id: `${Date.now()}-${i}`, date: '', service: '', provider: '', mileage: '', price: '', notes: `⚠️ Could not read (${d.error || 'parse failed'})`, fileName: file.name });
        }
      } catch {
        results.push({ id: `${Date.now()}-${i}`, date: '', service: '', provider: '', mileage: '', price: '', notes: '⚠️ Could not read this file', fileName: file.name });
      }
      setBatchProgress({ done: i + 1, total: list.length });
      setParsedBatch([...results]);
    }
    setBatchProgress(null);
  };

  const updateBatchRecord = (id: string, field: keyof ParsedRecord, value: string) =>
    setParsedBatch(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeBatchRecord = (id: string) => setParsedBatch(prev => prev.filter(r => r.id !== id));

  // Persist the reviewed batch against the vehicle + customer in the Torqued DB
  const saveBatch = async () => {
    const plate = (rego || vehicle?.rego || '').toUpperCase();
    if (!plate) { setReceiptError('No vehicle selected.'); return; }
    setBatchSaving(true);
    try {
      const res = await fetch('/api/customer/save-history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rego: plate, ownerId: customerOwnerId,
          records: parsedBatch.map(r => ({ date: r.date, service: r.service, provider: r.provider, mileage: r.mileage ? Number(r.mileage) : null, price: r.price, notes: r.notes })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setReceiptError(d.error || 'Could not save history.'); return; }
      // Reflect saved records in the on-screen history immediately
      setManualHistory(prev => [
        ...parsedBatch.map(r => ({ date: r.date, service: r.service, provider: r.provider, mileage: r.mileage || '', price: r.price, notes: r.notes })),
        ...prev,
      ]);
      setParsedBatch([]); setShowBatchReview(false);
    } catch {
      setReceiptError('Could not save. Please try again.');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleRegoLookup = async () => {
    if (!rego) return;
    const formattedRego = rego.toUpperCase().trim();
    setIsSearchingRego(true);
    setPlateMatchError(null);
    setShowNewCustomerForm(false);
    setReturningCustomerName(null);

    try {
      const res = await fetch('/api/customer/check-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rego: formattedRego }),
      });

      if (res.status === 404) {
        setPlateMatchError('Plate not found in our registry. Please check the number and try again.');
        return;
      }

      const data = await res.json();

      if (data.isNew) {
        // Plate has no owner. If THIS customer is already verified this session,
        // add the car to their existing garage instead of treating them as new.
        if (customerOwnerId) {
          const addRes = await fetch('/api/customer/add-vehicle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ownerId: customerOwnerId, rego: formattedRego }),
          });
          if (addRes.ok) {
            await loadVehicleByRego(formattedRego);
            return;
          }
        }
        // Otherwise it's a genuinely new customer — show registration form
        setShowNewCustomerForm(true);
      } else {
        // Returning customer — magic link emailed
        setReturningCustomerName(data.customerName);
        setMagicSentTo(data.maskedEmail || 'your registered email');
        setMagicFallbackLink(data.fallbackLink || null);
      }
    } catch (err) {
      setPlateMatchError('Could not connect. Please try again.');
    } finally {
      setIsSearchingRego(false);
    }
  };

  // Real AI fault code translation via Gemini
  useEffect(() => {
    if (faultCode.length < 4) { setAiTranslation(''); return; }
    setAiTranslation(`Interpreting ${faultCode.toUpperCase()}...`);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/fault-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: faultCode, make: vehicle?.make, model: vehicle?.model, year: vehicle?.year, mileage }),
        });
        const data = await res.json();
        setAiTranslation(data.translation || '');
      } catch {
        setAiTranslation('Unable to interpret code right now.');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [faultCode, vehicle]);

  const toggleService = (id: string) => {
    setSelectedServices(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Typical job durations (minutes) per service
  const SERVICE_DURATIONS: Record<string, number> = {
    oil: 45, wof: 60, full: 180, brakes_front_pads: 90, brakes_front_rotors: 120,
    brakes_rear_pads: 90, brakes_rear_rotors: 120, timing: 480, transmission: 240,
    battery: 30, diag_inspection: 60, spark_plugs: 90, cabin_filter: 20, brake_fluid: 60,
  };
  // Services that usually need parts ordered in (incur the workshop's parts lead time)
  const NEEDS_PARTS = new Set(['timing', 'transmission', 'brakes_front_rotors', 'brakes_rear_rotors', 'spark_plugs']);

  const addBusinessDays = (from: Date, days: number) => {
    const d = new Date(from);
    let added = 0;
    while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
    return d;
  };

  // Capacity-aware turnaround: parts lead time + job duration + technician capacity
  useEffect(() => {
    if (!selectedTime) return;
    const totalMins = selectedServices.reduce((s, id) => s + (SERVICE_DURATIONS[id] || 60), 0);
    const technicians = selectedMechanic?.technicians || 1;
    const partsLead = selectedMechanic?.partsLeadDays ?? 1;
    const needsParts = selectedServices.some(id => NEEDS_PARTS.has(id));
    // Effective bay-hours: longer jobs split across technicians
    const effectiveHours = (totalMins / 60) / Math.max(1, technicians);

    // Drop-off: next business day, or +partsLead if parts must be ordered
    const earliestDrop = needsParts ? addBusinessDays(new Date(), Math.max(1, partsLead) + 1) : addBusinessDays(new Date(), 1);
    setSelectedDate(earliestDrop.toISOString().slice(0, 10));

    const [hour, min] = selectedTime.split(':').map(Number);
    if (effectiveHours > 7) {
      // Multi-day job → ready next business day 5pm
      setEstimatedReadyTime('Next day, 5:00 PM');
    } else {
      let readyHour = hour + Math.ceil(effectiveHours);
      if (readyHour >= 17) { setEstimatedReadyTime('Same day, 5:00 PM'); return; }
      const ampm = readyHour >= 12 ? 'PM' : 'AM';
      if (readyHour > 12) readyHour -= 12;
      setEstimatedReadyTime(`${readyHour}:${min === 0 ? '00' : min} ${ampm}`);
    }
  }, [selectedServices, selectedTime, selectedMechanic]);

  const handleMockPaymentSuccess = async () => {
    if (!stripeInputEmail || !stripeInputEmail.includes('@')) {
      setCardError('Please enter a valid email address to complete the reservation.');
      return;
    }
    setCardError('');
    setStripeFormStep('processing');
    setStripeLoadingMessage('Running sandbox booking engine & state update...');
    
    setTimeout(async () => {
      const pending = localStorage.getItem('pending_booking');
      if (pending) {
        try {
          const booking = JSON.parse(pending);
          booking.paymentStatus = 'confirmed';
          booking.status = 'booked';
          booking.email = stripeInputEmail;
          booking.phone = stripeInputPhone;
          booking.customerName = cardName || userProfile?.name || 'Torqued Owner';
          
          if (updateProfile) {
            updateProfile({ 
              email: stripeInputEmail,
              phone: stripeInputPhone,
              name: cardName || userProfile?.name || ''
            });
          }
          
          setActiveJobs(prev => [...prev, booking]);
          setLatestBooking(booking);
          await triggerEmailConfirmation(booking);
        } catch (err) {
          console.error(err);
        }
      }
      setStripeFormStep('success');
    }, 2000);
  };

  const handleBooking = async () => {
    if (!selectedMechanic || !paymentMethod) return;
    setIsBookingLoading(true);

    const isFinanceNow = paymentMethod === 'Finance Now';
    const isImmediatePayment = ['Afterpay', 'Klarna', 'Latitude', 'Q Card', 'Credit / Debit', 'Credit or Debit Card'].includes(paymentMethod);

    // Dynamic price calculation
    const baseAmtPrice = isClaimApproved ? 450 : (selectedMechanic.estimatedPrice || totalPrice);
    const calculatedPrice = typeof baseAmtPrice === 'string' ? parseFloat(baseAmtPrice) : baseAmtPrice;
    
    // Total price is discounted on confirmation if promo code is applied
    const finalCalculatedPrice = calculatedPrice;

    const newJob: Job = {
      id: Math.random().toString(36).substr(2, 9),
      vehicleId: vehicle?.id || 'v1',
      serviceIds: selectedServices,
      mechanicId: selectedMechanic.id,
      status: (isFinanceNow || mbiStatus === 'not-claimed') ? 'pending' : 'booked',
      paymentStatus: isClaimApproved ? 'confirmed' : (isFinanceNow || mbiStatus === 'not-claimed' ? 'awaiting_approval' : 'confirmed'),
      paymentMethod: mbiStatus === 'not-claimed' ? 'Provident Insurance' : paymentMethod,
      date: selectedDate,
      totalPrice: finalCalculatedPrice,
      depositPaid: undefined,
      description: diagnosticComment?.trim() || faultCode || undefined,
    };

    if (isImmediatePayment) {
      // Torqued is prepaid in full — the customer pays the whole amount up front.
      const todayAmountToPay = calculatedPrice;

      // GUARD: If $219.00 OFF code brings due amount to $0, confirm directly without going to Stripe checkout
      if (todayAmountToPay === 0) {
        newJob.paymentStatus = 'confirmed';
        newJob.status = 'booked';
        localStorage.setItem('pending_booking', JSON.stringify(newJob));

        // Persist via service role so it shows in mechanic/admin portals even for anonymous customers
        fetch('/api/bookings/persist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingData: { ...newJob, email: customerEmail || userProfile?.email || user?.email || null, customerName: userName || undefined },
            userId: user?.id ?? customerOwnerId ?? null,
          }),
        }).catch(e => console.error('Failed to persist $0 booking:', e));

        setActiveJobs(prev => [...prev, newJob]);
        setLatestBooking(newJob);
        await triggerEmailConfirmation(newJob);
        
        setIsBookingLoading(false);
        setStep(7); // Jump directly to success screen
        return;
      }

      localStorage.setItem('pending_booking', JSON.stringify(newJob));
      setStripeFormStep('input');
      const initialEmail = userProfile?.email || user?.email || '';
      setStripeInputEmail(initialEmail && initialEmail !== 'customer@torqued.nz' ? initialEmail : '');
      setStripeInputPhone(userProfile?.phone || '');
      setCardNum('');
      setCardExp('');
      setCardCvc('');
      setCardName(userProfile?.name || '');
      setCardPostalCode('');
      setCardError('');
      
      setIsStripeSessionLoading(true);
      setStripeSessionError(null);
      setStripeIsMock(false);
      setShowStripeModal(true);
      setIsBookingLoading(false);
      
      try {
        const response = await fetch('/api/stripe/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: todayAmountToPay,
            bookingId: newJob.id,
            customerEmail: customerEmail || userProfile?.email || user?.email || 'customer@torqued.nz',
            description: `Torqued Repair Booking Ref ${newJob.id}`,
            bookingData: { ...newJob, email: customerEmail || userProfile?.email || user?.email || null, customerName: userName || undefined },
            userId: user?.id ?? customerOwnerId ?? null,
          })
        });
        
        if (!response.ok) {
          let errorMsg = `HTTP Error Status ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error) {
              errorMsg = errData.error;
            }
          } catch (e) {}
          throw new Error(errorMsg);
        }
        
        const session = await response.json();
        if (session && session.url) {
          if (!session.isMock) {
            // Real Stripe — redirect straight to hosted checkout, no modal needed
            window.location.href = session.url;
            return;
          }
          setStripeCheckoutUrl(session.url);
          setStripeIsMock(true);
        } else {
          throw new Error(session?.error || 'Unable to retrieve Stripe Checkout Session');
        }
      } catch (err) {
        console.error('Error fetching checkout session:', err);
        setStripeSessionError(err instanceof Error ? err.message : 'Unknown gateway connection error');
        setStripeCheckoutUrl(null);
      } finally {
        setIsStripeSessionLoading(false);
      }

      return;
    }

    // Default local & auth fallback (Finance Now, pending approvals, etc.)
    if (user) {
      supabase.from('bookings').upsert({
        id: newJob.id,
        customer_id: user.id,
        mechanic_id: newJob.mechanicId,
        vehicle_rego: newJob.vehicleId || null,
        service_ids: newJob.serviceIds,
        status: newJob.status,
        payment_status: newJob.paymentStatus,
        payment_method: newJob.paymentMethod,
        date: newJob.date,
        total_price: newJob.totalPrice,
        deposit_paid: newJob.depositPaid ?? null,
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error('Failed to persist booking:', error.message);
      });
    }
    setActiveJobs(prev => [...prev, newJob]);
    setLatestBooking(newJob);
    // Send email for fallback
    await triggerEmailConfirmation(newJob);
    setStep(7);
    setIsBookingLoading(false);
  };

  const deleteHistory = (index: number) => {
    setManualHistory(prev => prev.filter((_, i) => i !== index));
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">
                {isRAH190 ? `Welcome Back, ${userName} 👋` : 'Step 1: Enter Your Car'}
              </h2>
              {isRAH190 ? (
                <div className="space-y-4">
                  <p className="text-muted">
                    Your Golf GTE is tracked. We have <span className="text-torqued-red font-bold">{manualHistory.length} service records</span> on file spanning back to {manualHistory[manualHistory.length - 1]?.date}.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted/40">Verified History</h4>
                      <div className="flex items-center gap-2">
                        <label className={cn(
                          "h-7 px-2.5 inline-flex items-center text-[10px] font-bold rounded-lg cursor-pointer transition-all",
                          isParsingReceipt ? "bg-card text-muted cursor-wait" : "bg-torqued-red/10 text-torqued-red hover:bg-torqued-red/20"
                        )}>
                          {isParsingReceipt ? (
                            <><div className="w-3 h-3 border-2 border-torqued-red/30 border-t-torqued-red rounded-full animate-spin mr-1.5" /> Scanning…</>
                          ) : (
                            <><Mail size={12} className="mr-1" /> Scan Receipt</>
                          )}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            disabled={isParsingReceipt}
                            onChange={(e) => { handleReceiptUpload(e.target.files?.[0] || null); e.target.value = ''; }}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] text-foreground hover:bg-card"
                          onClick={() => setShowHistoryEntry(!showHistoryEntry)}
                        >
                          <Plus size={12} className="mr-1" /> Add Record
                        </Button>
                      </div>
                    </div>
                    {receiptError && <p className="text-[10px] text-torqued-red font-bold">{receiptError}</p>}

                    {/* Drag-and-drop multi-file importer (PDF + images) */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleMultiUpload(Array.from(e.dataTransfer.files)); }}
                      className={cn(
                        "rounded-xl border-2 border-dashed p-4 text-center transition-all",
                        isDragging ? "border-torqued-red bg-torqued-red/5" : "border-border hover:border-torqued-red/40"
                      )}
                    >
                      <label className="cursor-pointer block">
                        <Download size={18} className="mx-auto text-torqued-red mb-1.5" />
                        <p className="text-xs font-bold">Drag &amp; drop receipts here</p>
                        <p className="text-[10px] text-muted">Multiple PDFs or photos at once · AI reads them into your history</p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => { handleMultiUpload(Array.from(e.target.files || [])); e.target.value = ''; }}
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      {manualHistory.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-card border border-border rounded-xl group hover:border-torqued-red/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center text-muted">
                              <History size={14} />
                            </div>
                            <div>
                              <div className="text-sm font-bold">{item.service}</div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <div className="text-[10px] text-muted uppercase font-black">{item.date} • {item.provider}</div>
                                {item.price && <span className="text-[10px] bg-torqued-red/10 text-torqued-red px-1.5 rounded font-bold">{item.price}</span>}
                                {item.notes && <span className="text-[10px] text-muted/60 italic">({item.notes})</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEntryDate(item.date);
                                setEntryService(item.service);
                                setEntryProvider(item.provider);
                                setEntryMileage(item.mileage || '');
                                setEntryPrice(item.price || '');
                                setEntryNotes(item.notes || '');
                                setShowHistoryEntry(true);
                                deleteHistory(i);
                              }}
                              className="p-1.5 hover:bg-background rounded-lg text-muted hover:text-foreground"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => deleteHistory(i)}
                              className="p-1.5 hover:bg-torqued-red/10 rounded-lg text-muted hover:text-torqued-red"
                            >
                              <Plus size={12} className="rotate-45" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {showHistoryEntry && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-card rounded-2xl border border-border space-y-3"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <Input 
                            label="Service Date" 
                            type="text" 
                            placeholder="E.g. Oct 14th 2025"
                            className="bg-background" 
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                          />
                          <Input 
                            label="Mileage (km)" 
                            placeholder="E.g. 103,000" 
                            className="bg-background" 
                            value={entryMileage}
                            onChange={(e) => setEntryMileage(e.target.value)}
                          />
                        </div>
                        <Input 
                          label="Service Performed" 
                          placeholder="Oil change..." 
                          className="bg-background" 
                          value={entryService}
                          onChange={(e) => setEntryService(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input 
                            label="Provider" 
                            placeholder="Precision Mech..." 
                            className="bg-background" 
                            value={entryProvider}
                            onChange={(e) => setEntryProvider(e.target.value)}
                          />
                          <Input 
                            label="Price (Optional)" 
                            placeholder="E.g. $150" 
                            className="bg-background" 
                            value={entryPrice}
                            onChange={(e) => setEntryPrice(e.target.value)}
                          />
                        </div>
                        <Input 
                          label="Notes / Type (Optional)" 
                          placeholder="e.g. External Record" 
                          className="bg-background" 
                          value={entryNotes}
                          onChange={(e) => setEntryNotes(e.target.value)}
                        />
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" className="flex-1 bg-torqued-red text-white" onClick={() => {
                            if (!entryDate || !entryService) return;
                            setManualHistory([{
                              date: entryDate, 
                              service: entryService, 
                              provider: entryProvider || 'Unknown',
                              mileage: entryMileage,
                              price: entryPrice,
                              notes: entryNotes
                            }, ...manualHistory]);
                            setShowHistoryEntry(false);
                            setEntryDate('');
                            setEntryService('');
                            setEntryProvider('');
                            setEntryMileage('');
                            setEntryPrice('');
                            setEntryNotes('');
                          }}>Save Record</Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowHistoryEntry(false)}>Cancel</Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted">
                  We'll use your rego to pull exact specs for accurate parts pricing.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input 
                  placeholder="ENTER NUMBER PLATE (E.G. RAH190)" 
                  value={rego}
                  onChange={(e) => setRego(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && rego && !isSearchingRego) {
                      e.preventDefault();
                      handleRegoLookup();
                    }
                  }}
                  className="text-lg sm:text-2xl font-display font-bold placeholder:font-normal bg-card border-border text-foreground placeholder:text-muted focus:ring-1 focus:ring-torqued-red"
                />
              </div>
              <Button onClick={handleRegoLookup} disabled={isSearchingRego || !rego} className="bg-torqued-red">
                {isSearchingRego ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={20} />}
              </Button>
            </div>

            {vehicle && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 border-border bg-card shadow-2xl">
                  <img src={vehicle.thumbnail} alt="Vehicle" className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl object-cover" />
                  <div className="flex-1 text-center sm:text-left">
                    <div className="torqued-badge mb-1">{vehicle.rego}</div>
                    <h3 className="text-xl sm:text-2xl">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                    <p className="text-xs sm:text-sm text-muted">{vehicle.variant}</p>
                  </div>
                  <CheckCircle2 className="hidden sm:block ml-auto text-green-500" size={32} />
                </Card>
                <div className="mt-8 space-y-4">
                  <Input
                    label="Current Mileage (km)"
                    placeholder="E.g. 98000"
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    onBlur={() => {
                      const km = parseInt(mileage, 10);
                      const plate = (vehicle?.rego || rego || '').toUpperCase();
                      if (plate && Number.isFinite(km) && km > 0) {
                        fetch(`/api/vehicles/${encodeURIComponent(plate)}/mileage`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ mileage: km, phase: 'customer' }),
                        }).catch(() => {});
                      }
                    }}
                    className="bg-card border-border text-foreground"
                  />
                  
                  {/* New Customer / Service History Section */}
                  {!isRAH190 && (
                    <div className="pt-4 border-t border-border space-y-4">
                      <div className="flex items-center justify-between">
                         <label className="text-sm font-bold">New to Torqued?</label>
                         <button 
                          onClick={() => setIsNewVehicle(!isNewVehicle)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            isNewVehicle ? "bg-torqued-red" : "bg-card"
                          )}
                         >
                           <div className={cn(
                               "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                               isNewVehicle ? "left-7" : "left-1"
                           )} />
                         </button>
                      </div>
                      
                      {isNewVehicle && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <p className="text-xs text-muted italic">Adding your purchase details helps us fine-tune your "Auto" assisted schedule.</p>
                          <div className="grid grid-cols-2 gap-4">
                            <Input 
                              label="Purchase Date" 
                              type="date"
                              value={purchaseDate}
                              onChange={(e) => setPurchaseDate(e.target.value)}
                              className="bg-card border-border text-foreground"
                            />
                            <Input 
                              label="Purchase Mileage" 
                              type="number"
                              placeholder="Km at purchase"
                              value={purchaseMileage}
                              onChange={(e) => setPurchaseMileage(e.target.value)}
                              className="bg-card border-border text-foreground"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-white/50">Service History (Optional)</label>
                            <div className="space-y-2">
                              {manualHistory.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-2 bg-white/5 rounded-lg text-xs">
                                  <div className="space-y-0.5">
                                    <div className="font-bold">{item.date} - {item.service}</div>
                                    <div className="opacity-60 flex gap-2">
                                      <span>{item.provider}</span>
                                      {item.mileage && <span>• {item.mileage} km</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  fullWidth
                                  size="sm"
                                  className="text-[10px] h-8 border-white/20"
                                  onClick={() => setShowHistoryEntry(!showHistoryEntry)}
                                >
                                  <Plus size={12} className="mr-1" /> Add Manual Entry
                                </Button>
                                <label className={cn(
                                  "flex-1 text-[10px] h-8 inline-flex items-center justify-center rounded-md font-bold cursor-pointer transition-all border",
                                  isParsingReceipt ? "border-white/10 text-muted cursor-wait" : "border-torqued-red/40 text-torqued-red hover:bg-torqued-red/10"
                                )}>
                                  {isParsingReceipt ? (
                                    <><div className="w-3 h-3 border-2 border-torqued-red/30 border-t-torqued-red rounded-full animate-spin mr-1.5" /> Scanning…</>
                                  ) : (
                                    <><Mail size={12} className="mr-1" /> Scan Receipt (AI)</>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    disabled={isParsingReceipt}
                                    onChange={(e) => { handleReceiptUpload(e.target.files?.[0] || null); e.target.value = ''; }}
                                  />
                                </label>
                              </div>
                              {receiptError && <p className="text-[10px] text-torqued-red font-bold">{receiptError}</p>}

                              {showHistoryEntry && (
                                <div className="p-3 bg-white/5 rounded-xl space-y-2 border border-white/10">
                                  <Input 
                                    label="Service Date" 
                                    type="date" 
                                    className="h-8 text-xs bg-white/5 border-white/10" 
                                    value={entryDate}
                                    onChange={(e) => setEntryDate(e.target.value)}
                                  />
                                  <Input 
                                    label="Service Performed" 
                                    placeholder="Oil change..." 
                                    className="h-8 text-xs bg-white/5 border-white/10" 
                                    value={entryService}
                                    onChange={(e) => setEntryService(e.target.value)}
                                  />
                                  <Input 
                                    label="Mileage (km)" 
                                    placeholder="E.g. 85000" 
                                    type="number"
                                    className="h-8 text-xs bg-white/5 border-white/10" 
                                    value={entryMileage}
                                    onChange={(e) => setEntryMileage(e.target.value)}
                                  />
                                  <div className="relative">
                                    <Input 
                                      label="Provider" 
                                      placeholder="Precision Mech..." 
                                      className="h-8 text-xs bg-white/5 border-white/10" 
                                      value={entryProvider}
                                      onChange={(e) => setEntryProvider(e.target.value)}
                                    />
                                    {filteredProviders.length > 0 && (
                                      <div className="absolute z-10 w-full bg-torqued-dark border border-white/10 rounded-lg mt-1 shadow-lg overflow-hidden">
                                        {filteredProviders.map(p => (
                                          <button
                                            key={p}
                                            className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-torqued-red/5 hover:text-torqued-red transition-all border-b border-white/5 last:border-0"
                                            onClick={() => setEntryProvider(p)}
                                          >
                                            {p}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <Button size="sm" fullWidth onClick={() => {
                                    if (!entryDate || !entryService) return;
                                    setManualHistory([...manualHistory, {
                                      date: entryDate, 
                                      service: entryService, 
                                      provider: entryProvider || 'Unknown',
                                      mileage: entryMileage
                                    }]);
                                    setShowHistoryEntry(false);
                                    setEntryDate('');
                                    setEntryService('');
                                    setEntryProvider('');
                                    setEntryMileage('');
                                  }}>Save Entry</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  <Button fullWidth onClick={() => setStep(2)} disabled={!mileage} className="bg-torqued-red">Continue to Services →</Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        );

      case 2:
        const isCurrentlyRAH190 = rego === 'RAH190';
        const rah190Suggestions = ['spark_plugs', 'brakes_front_pads', 'oil'];
        const displaySuggestions = isCurrentlyRAH190 ? rah190Suggestions : suggestedJobs;

        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(1)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl md:text-4xl">{isRAH190 ? 'Step 2: What Are You After?' : 'Step 2: What Do You Need?'}</h2>
                <p className="text-sm sm:text-base text-white/60">
                  {isRAH190 ? 'Your service history looks great -- what are you after today?' : 'Select a standard service or describe a problem.'}
                </p>
              </div>
            </div>

            {!quotePath ? (
              <div className="space-y-6">
              {displaySuggestions.length > 0 && (
                <div className="p-4 bg-torqued-red/5 border border-torqued-red/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-torqued-red font-bold uppercase tracking-widest text-[10px]">
                    <AlertTriangle size={14} /> {isRAH190 ? 'Top maintenance picks for your Golf GTE' : `Recommended for your mileage (${mileage} km)`}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {displaySuggestions.map(id => {
                      const service = SERVICES.find(s => s.id === id);
                      if (!service) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setQuotePath('service');
                            if (!selectedServices.includes(id)) toggleService(id);
                          }}
                          className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-torqued-red/5 hover:border-torqued-red/30 transition-all text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{service.icon}</span>
                            <span className="text-xs font-bold uppercase">{service.name}</span>
                          </div>
                          <Plus size={14} className="text-torqued-red" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Card 
                  hoverable 
                  className="p-6 sm:p-10 text-center space-y-4 border-border bg-card active:scale-95 transition-transform"
                  onClick={() => setQuotePath('service')}
                >
                  <div className="w-16 h-16 bg-torqued-red/5 rounded-full flex items-center justify-center mx-auto ring-1 ring-torqued-red/10">
                    <Wrench size={28} className="text-torqued-red" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl tracking-tight">I know what I need</h3>
                  <p className="text-sm text-muted">Select from common services like Oil Change or WOF.</p>
                </Card>
                <Card 
                  hoverable 
                  className="p-6 sm:p-10 text-center space-y-4 border-border bg-card active:scale-95 transition-transform"
                  onClick={() => setQuotePath('fault')}
                >
                  <div className="w-16 h-16 bg-torqued-red/5 rounded-full flex items-center justify-center mx-auto ring-1 ring-torqued-red/10">
                    <AlertTriangle size={28} className="text-torqued-red" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl tracking-tight">I have a problem</h3>
                  <p className="text-sm text-muted">Describe symptoms or enter a diagnostic fault code.</p>
                </Card>
              </div>
            </div>
            ) : quotePath === 'service' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {SERVICES.map(service => (
                    <button
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={cn(
                        "p-4 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                        selectedServices.includes(service.id) 
                          ? "border-torqued-red bg-torqued-red/10 text-torqued-red" 
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <span className="text-2xl">{service.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-tight leading-tight">{service.name}</span>
                    </button>
                  ))}
                </div>
                {totalPrice > 0 && (
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                    <span className="text-xs font-bold uppercase text-white/40">Estimated Total</span>
                    <span className="text-xl font-bold text-torqued-red">${totalPrice}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                    {selectedServices.includes('diag_inspection') ? 'Describe your concern *' : 'Additional Notes'}
                  </label>
                  <textarea
                    value={diagnosticComment}
                    onChange={e => setDiagnosticComment(e.target.value)}
                    className={cn(
                      "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none focus:bg-white/10 transition-all min-h-[100px] text-white",
                      selectedServices.includes('diag_inspection') && !diagnosticComment.trim()
                        ? "border-torqued-red/60 focus:border-torqued-red"
                        : "border-white/10 focus:border-torqued-red/30"
                    )}
                    placeholder={selectedServices.includes('diag_inspection')
                      ? `Describe your concern about your ${[vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'vehicle'} here`
                      : 'Anything else we should know?'}
                  />
                  {selectedServices.includes('diag_inspection') && !diagnosticComment.trim() && (
                    <p className="text-[10px] text-torqued-red">Required for diagnostic bookings — your mechanic reviews this before the inspection.</p>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setQuotePath(null)}>Back</Button>
                  <Button className="flex-1 bg-torqued-red" onClick={() => { lookupFleetQuote(); setStep(3); }}
                    disabled={selectedServices.length === 0 || (selectedServices.includes('diag_inspection') && !diagnosticComment.trim())}>
                    Continue →
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50">Describe the issue</label>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:bg-white/10 focus:border-torqued-red/30 transition-all min-h-[120px] text-white"
                    placeholder="E.g. Squeaking when braking, engine light is on..."
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50">Fault Code (Optional)</label>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-torqued-red uppercase bg-torqued-red/10 px-2 py-0.5 rounded">
                      <Lock size={10} /> Torqued Pro
                    </div>
                  </div>
                  <Input 
                    placeholder="E.G. P0301" 
                    value={faultCode}
                    onChange={(e) => setFaultCode(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  {aiTranslation && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs leading-relaxed"
                    >
                      <div className="flex items-center gap-2 mb-1 text-torqued-red font-bold uppercase tracking-widest text-[10px]">
                        <Info size={12} /> Auto Interpretation
                      </div>
                      {aiTranslation}
                    </motion.div>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setQuotePath(null)}>Back</Button>
                  <Button className="flex-1 bg-torqued-red" onClick={() => {
                    if (!faultCode) {
                      setIsDiagnosticMode(true);
                    } else {
                      lookupFleetQuote(); setStep(3);
                    }
                  }}>Continue →</Button>
                </div>
              </div>
            )}

            {isDiagnosticMode && !isDiagnosticSimulatedComplete && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              >
                <Card className="max-w-md w-full p-8 space-y-6 overflow-hidden relative border-white/10 bg-torqued-dark">
                   <button 
                    onClick={() => setIsDiagnosticMode(false)}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                   >
                     ✕
                   </button>
                   <div className="space-y-2">
                     <div className="w-12 h-12 bg-torqued-red/10 rounded-full flex items-center justify-center">
                        <Wrench size={24} className="text-torqued-red" />
                     </div>
                     <h3 className="text-3xl font-bold tracking-tight text-white">Diagnostic Needed</h3>
                     <p className="text-white/60">Since there's no fault code, we need a physical inspection to quote accurately.</p>
                   </div>

                   <div className="space-y-4 pt-4">
                      {[
                        { step: 1, text: "Book a diagnostic appointment ($99 set fee)." },
                        { step: 2, text: "Visit your mechanic for a 45min inspection." },
                        { step: 3, text: "Your mechanic will generate a quote within seconds of diagnosing the problem." },
                        { step: 4, text: "Receive and compare your quote to market averages." },
                        { step: 5, text: "Book your repair with Torqued simplicity." }
                      ].map(s => (
                        <div key={s.step} className="flex gap-4 items-start text-white">
                          <div className="w-6 h-6 rounded-full bg-torqued-red text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {s.step}
                          </div>
                          <p className="text-sm font-medium leading-snug">{s.text}</p>
                        </div>
                      ))}
                   </div>

                   <div className="space-y-2 pt-2 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/50">What are you experiencing? (optional)</label>
                      <textarea
                        value={diagnosticComment}
                        onChange={(e) => setDiagnosticComment(e.target.value)}
                        rows={3}
                        placeholder="E.g. Grinding noise when braking, judder at 80km/h, warning light on dash…"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-torqued-red"
                      />
                      <p className="text-[11px] text-white/40">Your mechanic sees this before diagnosing.</p>
                   </div>

                   <div className="pt-2">
                      <Button fullWidth size="lg" className="bg-torqued-red text-white hover:bg-red-700" onClick={() => {
                        setIsDiagnosticMode(false);
                        setSelectedServices(['diag_inspection']);
                        setStep(3); // Find a mechanic, then pay — quote comes after inspection
                      }}>Book Diagnostic Appointment →</Button>
                   </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(2)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">Step 3: Your Location</h2>
                <p className="text-sm sm:text-base text-muted">Find mechanics near you.</p>
              </div>
            </div>

            <div className="space-y-6">
              <Input 
                label="Suburb or Postcode"
                placeholder="E.g. South Auckland"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                icon={<MapPin size={20} />}
                className="bg-card border-border"
              />
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Search Radius</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['5km', '10km', '25km', 'Any'].map(r => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      className={cn(
                        "py-3 rounded-xl border font-bold text-sm transition-all",
                        radius === r ? "border-torqued-red bg-torqued-red text-white" : "border-border bg-card text-foreground hover:bg-background"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {fleetQuoteState === 'fallback' ? (() => {
                const greetName = (userName || returningCustomerName || '').split(' ')[0] || 'there';
                const makeModel = carjamVehicle
                  ? `${carjamVehicle.make.charAt(0) + carjamVehicle.make.slice(1).toLowerCase()} ${carjamVehicle.model.charAt(0) + carjamVehicle.model.slice(1).toLowerCase()}`
                  : `${vehicle?.make ?? ''} ${vehicle?.model ?? ''}`.trim() || 'your vehicle';
                const low = fleetQuoteRange?.low ?? 150;
                const high = fleetQuoteRange?.high ?? 2500;
                const hasRange = low !== 150 || high !== 2500;
                return (
                  <Card className="p-6 sm:p-8 bg-card border-border text-foreground space-y-5 shadow-xl">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
                        <Info size={10} /> Indicative estimate · Confirmed quote coming
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Estimated Price Range</p>
                      <h3 className="text-4xl sm:text-5xl text-torqued-red tracking-tighter font-black">${low} – ${high}</h3>
                      {!hasRange && (
                        <p className="text-xs text-muted italic">varies significantly by vehicle</p>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed border-t border-border pt-4">
                      Hi {greetName}, we don't have exact pricing for your {makeModel} yet.
                      Based on similar vehicles, this job typically costs <span className="font-bold text-foreground">${low}–${high}</span>.
                      We're crunching the exact numbers — you'll get a confirmed quote by email within 2 hours.
                    </p>
                  </Card>
                );
              })() : fleetQuoteState === 'instant' && fleetQuoteRange ? (
                <Card className="p-8 bg-card border-border text-foreground space-y-6 shadow-xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-torqued-red/10 border border-torqued-red/20 text-torqued-red text-[10px] font-bold uppercase tracking-widest">
                      <Info size={10} /> Indicative estimate
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Estimated Price Range</p>
                      <h3 className="text-4xl sm:text-5xl text-torqued-red tracking-tighter font-black">${fleetQuoteRange.low} – ${fleetQuoteRange.high}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Fleet data</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted italic border-t border-border pt-4">
                    *Final price confirmed by your matched mechanic before work begins.
                  </p>
                </Card>
              ) : (
                <Card className="p-8 bg-card border-border text-foreground space-y-6 shadow-xl">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Estimated Price Range</p>
                      <h3 className="text-4xl sm:text-5xl text-torqued-red tracking-tighter font-black">${Math.floor(totalPrice * 0.9)} – ${Math.ceil(totalPrice * 1.2)}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Market data</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted italic border-t border-border pt-4">
                    *Final price confirmed by your matched mechanic before work begins.
                  </p>
                </Card>
              )}

              <Button fullWidth size="lg" className="h-16 text-lg rounded-2xl bg-torqued-red text-white shadow-xl shadow-torqued-red/10" onClick={() => setStep(4)}>Match Me with a Mechanic →</Button>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(3)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">3 Mechanics Found</h2>
            </div>

            <div className="bg-torqued-red/5 p-4 sm:p-6 rounded-2xl border border-torqued-red/10 flex items-start gap-4">
              <div className="bg-torqued-red text-white p-2 rounded-xl shadow-lg shrink-0">
                <Wrench size={18} />
              </div>
              <p className="text-xs font-medium leading-relaxed text-foreground">
                <span className="font-black text-torqued-red uppercase tracking-widest text-[10px] block mb-1">Smart Match</span>
                Based on your {vehicle?.year} {vehicle?.make}, we've prioritised mechanics with {
                  vehicle?.make === 'Tesla' ? 'EV and Technology specialist' : 
                  (vehicle?.make === 'Volkswagen' || vehicle?.make === 'Audi' || vehicle?.make === 'BMW') ? 'European vehicle expertise' :
                  'General maintenance and multi-brand'
                } experience.
              </p>
            </div>

            <div className="space-y-4">
              {!customerCoords && (
                <Card className="p-4 bg-card border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold flex items-center gap-1.5"><MapPin size={14} className="text-torqued-red" /> Find workshops near you</p>
                    <p className="text-xs text-muted mt-0.5">{locationAsked ? 'Location unavailable — showing all workshops.' : 'Allow location to see the closest mechanics within 75 km.'}</p>
                  </div>
                  {!locationAsked && <Button size="sm" className="bg-torqued-red text-white shrink-0" onClick={requestLocation}>Use my location</Button>}
                </Card>
              )}
              {(() => {
                // When we know the consumer's location, only show workshops within 75 km
                const within = customerCoords
                  ? mechanicsByDistance.filter(m => m.latitude != null && m.distance <= 75)
                  : mechanicsByDistance;
                if (within.length === 0) {
                  return (
                    <Card className="p-8 text-center bg-card border-border">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-torqued-red/10 flex items-center justify-center text-torqued-red mb-3"><MapPin size={20} /></div>
                      <p className="text-sm font-bold">Coming soon to your area</p>
                      <p className="text-xs text-muted mt-1">{customerCoords ? 'No Torqued workshops within 75 km yet.' : 'We\'re onboarding trusted local mechanics.'} We\'ll notify you the moment one is available nearby.</p>
                    </Card>
                  );
                }
                return null;
              })()}
              {(customerCoords ? mechanicsByDistance.filter(m => m.latitude != null && m.distance <= 75) : mechanicsByDistance)
                .map((mechanic, idx) => (
                <motion.div
                  key={mechanic.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="p-6 space-y-6 relative bg-card border-border shadow-md hover:shadow-xl transition-all group/card">
                    {mechanic.isFeatured && (
                      <div className="absolute top-0 right-0 bg-torqued-red text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                        <Star size={12} className="fill-current" /> Trusted Match
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="flex gap-4 flex-1">
                        <div className="relative">
                          <img src={mechanic.logo} alt={mechanic.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-1 ring-border group-hover/card:ring-torqued-red/30 transition-all" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <h3 className="text-xl sm:text-2xl leading-tight tracking-tight font-black">{mechanic.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                            <MapPin size={12} className="text-torqued-red" />
                            <span>{mechanic.suburb} • {mechanic.distance} km away</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Star size={12} className="text-yellow-400 fill-current" />
                            <span className="text-sm font-bold">{mechanic.rating}</span>
                            <span className="text-xs text-muted">({mechanic.reviews} reviews)</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-1.5 border-t sm:border-t-0 border-border pt-4 sm:pt-0">
                        <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Est. Quote</p>
                        <p className="text-2xl sm:text-3xl font-black text-torqued-red tracking-tighter">${totalPrice + (idx * 20)}</p>
                      </div>
                    </div>
                    
                    {mechanic.address && (
                      <a 
                        href={mechanic.mapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-background border border-border rounded-2xl hover:bg-torqued-red/5 hover:border-torqued-red/20 transition-all group/loc"
                      >
                        <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center border border-border shadow-sm group-hover/loc:bg-torqued-red group-hover/loc:text-white transition-all">
                          <MapPin size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase text-muted leading-none mb-1.5 tracking-widest">Workshop Address</p>
                          <p className="text-sm font-medium text-foreground truncate">{mechanic.address}</p>
                        </div>
                        <ChevronRight size={18} className="text-muted group-hover/loc:text-torqued-red transition-all" />
                      </a>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {mechanic.specialisations.map(s => (
                        <span key={s} className="text-[10px] font-bold uppercase bg-card border border-border px-3 py-1 rounded-xl text-muted">{s}</span>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border gap-4">
                      <div className="flex items-center gap-2 text-emerald-500 w-full sm:w-auto">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold uppercase tracking-widest">Next Available: {mechanic.nextAvailable}</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-initial border-border text-foreground hover:bg-card h-10 px-6 font-bold uppercase tracking-widest text-[10px]">Profile</Button>
                        <Button size="sm" className="flex-[2] sm:flex-initial bg-torqued-red hover:bg-red-700 text-white h-10 px-8 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-torqued-red/20" onClick={() => {
                          setSelectedMechanic({ ...mechanic, estimatedPrice: totalPrice });
                          setMechanicPackages([]);
                          // Fetch this mechanic's packages and recalculate price for the customer's vehicle
                          fetch(`/api/mechanic/${mechanic.id}/package-price${vehicle?.rego ? `?rego=${vehicle.rego}` : ''}`)
                            .then(r => r.json())
                            .then(d => {
                              const pkgs: any[] = d.packages || [];
                              setMechanicPackages(pkgs);
                              if (!pkgs.length) return;
                              const hasTransmission = selectedServices.includes('transmission');
                              const standardServices = selectedServices.filter(s => s !== 'transmission');
                              const standardPkgs = pkgs.filter((p: any) => p.pkg_type === 'standard');
                              const transPkgs = pkgs.filter((p: any) => p.pkg_type === 'transmission');
                              let pkgTotal = 0;
                              if (standardServices.length && standardPkgs.length) pkgTotal += Math.min(...standardPkgs.map((p: any) => p.calculatedPrice || p.price || 0));
                              else if (standardServices.length) pkgTotal += totalPrice;
                              if (hasTransmission && transPkgs.length) pkgTotal += transPkgs[0].calculatedPrice || transPkgs[0].price || 0;
                              else if (hasTransmission) pkgTotal += SERVICES.find(s => s.id === 'transmission')?.basePrice || 0;
                              if (pkgTotal > 0) setSelectedMechanic(prev => prev ? { ...prev, estimatedPrice: pkgTotal } : null);
                            })
                            .catch(() => {});
                          // Diagnostic is booked & paid like any other service — the mechanic quotes after inspecting.
                          setStep(5);
                        }}>{selectedServices.includes('diag_inspection') ? 'Book Diagnostic' : 'Select & Schedule'}</Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {isDiagnosticSimulatedComplete && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-torqued-dark/95 backdrop-blur-md"
              >
                <div className="max-w-xl w-full space-y-8 text-center text-white">
                   <div className="space-y-4">
                      <div className="w-20 h-20 bg-torqued-red rounded-full flex items-center justify-center mx-auto animate-pulse">
                         <CheckCircle2 size={40} />
                      </div>
                      <h2 className="text-5xl font-bold">Your Quote is Ready!</h2>
                      <p className="text-white/60 text-lg">Your diagnostic was successful. We've matched the fault to a specific major repair.</p>
                   </div>

                   <Card className="p-8 bg-torqued-dark text-white text-left space-y-6 border border-white/10 shadow-2xl">
                      <div className="flex justify-between items-start">
                         <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Diagnosed Problem</h4>
                            <p className="text-xl font-bold">DQ400e Hybrid Mechatronics Unit Failure</p>
                            <p className="text-xs text-white/40 mt-1">Requires unit replacement & system recalibration</p>
                         </div>
                         <div className="px-3 py-1 bg-torqued-red text-white text-[10px] font-bold uppercase rounded">
                            Verified Fix
                         </div>
                      </div>

                      <div className="space-y-3">
                        <div className="p-4 bg-red-50 rounded-xl border border-torqued-red/10 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-bold uppercase text-torqued-red">Repair Estimate</p>
                              <p className="text-3xl font-bold">$6,997.00</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-bold uppercase text-white/40">Comparison</p>
                              <p className="text-xs font-bold text-torqued-red inline-flex items-center gap-1">
                                <AlertTriangle size={12} /> Fair Market Price
                              </p>
                              <p className="text-[9px] text-white/40 leading-none">High-value specialized hybrid component</p>
                           </div>
                        </div>
                        
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                           <div className="flex justify-between text-xs mb-2">
                             <span className="text-white/60">DQ400e Mechatronics Unit</span>
                             <span className="font-bold">$5,297.00</span>
                           </div>
                           <div className="flex justify-between text-xs mb-2">
                             <span className="text-white/60">Import Fees & Customs</span>
                             <span className="font-bold">$1,000.00</span>
                           </div>
                           <div className="flex justify-between text-xs mb-2">
                             <span className="text-white/60">Express Freight (Germany)</span>
                             <span className="font-bold">$100.00</span>
                           </div>
                           <div className="flex justify-between text-xs">
                             <span className="text-white/60">Specialized Labour (4 Hours)</span>
                             <span className="font-bold">$600.00</span>
                           </div>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-4">
                         <div className="flex items-center gap-4">
                            <div className="bg-emerald-500 text-white p-2 rounded-lg">
                               <Info size={20} />
                            </div>
                            <div className="flex-1">
                               <p className="text-sm font-bold text-emerald-900 leading-tight">Got Provident MBI?</p>
                               <p className="text-xs text-emerald-700">Mechatronic units are typically covered.</p>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2">
                           <button 
                            onClick={() => {
                              setHasMBI(true);
                              setMbiStatus('pre-approved');
                            }}
                            className={cn(
                              "p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-center transition-all",
                              mbiStatus === 'pre-approved' ? "bg-emerald-600 text-white" : "bg-white/5 border border-white/10 text-white/60"
                            )}
                           >
                              Pre-Approved
                           </button>
                           <button 
                            onClick={() => {
                              setHasMBI(true);
                              setMbiStatus('not-claimed');
                            }}
                            className={cn(
                              "p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-center transition-all",
                              mbiStatus === 'not-claimed' ? "bg-emerald-600 text-white" : "bg-white/5 border border-white/10 text-white/60"
                            )}
                           >
                              No Claim Yet
                           </button>
                         </div>
                      </div>

                      <div className="space-y-3">
                         <p className="text-xs text-white/60 leading-relaxed italic">"Torqued simplicity - finance and book online, we will save the service history for next time."</p>
                         <Button fullWidth size="lg" onClick={() => {
                            setSelectedServices(['mechatronics_replace']);
                            if (selectedMechanic) {
                              setSelectedMechanic({ ...selectedMechanic, estimatedPrice: 6997 });
                            }
                            setIsRepairFromDiagnostic(true);
                            setIsDiagnosticSimulatedComplete(false);
                            setStep(5); // Proceed to scheduling the actual repair
                         }}>Proceed with Repair →</Button>
                         <Button variant="outline" fullWidth onClick={() => {
                            setIsDiagnosticSimulatedComplete(false);
                            setStep(1); // For demo, let them reset or go back
                         }}>Decline Quote</Button>
                      </div>
                   </Card>
                </div>
              </motion.div>
            )}
          </motion.div>
        );

      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(4)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">Step 5: When works?</h2>
                <p className="text-sm sm:text-base text-muted">Select drop-off for {selectedMechanic?.name}.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-4">
                   <label className="text-xs font-black uppercase tracking-widest text-muted">Drop off Day</label>
                   <div className="grid grid-cols-3 gap-3">
                      {[
                        { day: 'Thursday', date: '2026-04-23', label: 'Thursday 23rd' },
                        { day: 'Friday', date: '2026-04-24', label: 'Friday 24th' },
                        { day: 'Monday', date: '2026-04-27', label: 'Monday 27th' },
                      ].map(d => (
                        <button 
                          key={d.date}
                          onClick={() => setSelectedDate(d.date)}
                          className={cn(
                            "p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all text-center",
                            selectedDate === d.date ? "border-torqued-red bg-torqued-red text-white shadow-lg shadow-torqued-red/20" : "border-border bg-card text-muted hover:border-torqued-red/30 hover:text-torqued-red"
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="text-xs font-black uppercase tracking-widest text-muted">Preferred Time</label>
                   <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={cn(
                            "p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all text-center",
                            selectedTime === t ? "border-torqued-red bg-torqued-red text-white shadow-lg shadow-torqued-red/20" : "border-border bg-card text-muted hover:border-torqued-red/30 hover:text-torqued-red"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                   </div>
                </div>

                <Card className="p-8 bg-card border-border border-l-4 border-l-torqued-red shadow-xl space-y-6">
                   <div className="flex items-center gap-4 text-torqued-red">
                      <Clock size={24} />
                      <h4 className="font-black uppercase tracking-widest text-[10px]">Booking Window: {selectedDate} @ {selectedTime}</h4>
                   </div>
                   <div className="pt-6 border-t border-border">
                      <p className="text-[10px] font-bold uppercase text-muted mb-2 tracking-widest">Estimated Collection</p>
                      <p className="text-4xl sm:text-5xl font-black tracking-tighter text-torqued-red">{estimatedReadyTime}</p>
                      <p className="text-[10px] text-muted mt-4 italic leading-relaxed">
                        {selectedServices.some(s => s.includes('timing')) ? 
                          "*Major repairs typically require the vehicle for the full day." : 
                          "*Standard service turnaround is approximately 4 hours."}
                      </p>
                   </div>
                </Card>

                <Button fullWidth size="lg" className="h-16 text-lg rounded-2xl bg-torqued-red text-white shadow-xl shadow-torqued-red/20" onClick={() => setStep(6)}>Proceed to Payment →</Button>
              </div>

              <div className="space-y-6">
                 <h4 className="text-xs font-black uppercase tracking-widest text-muted">Awaiting your arrival</h4>
                 <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 flex gap-5">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                       <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-emerald-600">Workshop Capacity Confirmed</p>
                        <p className="text-xs text-muted leading-relaxed mt-1">We've tentatively reserved this slot. Completing payment will lock it in.</p>
                    </div>
                 </div>
                 
                 <div className="p-8 border border-border rounded-3xl space-y-6 bg-card">
                    <h5 className="text-[10px] font-black uppercase text-muted tracking-[0.2em]">Drop-off Instructions</h5>
                    <div className="space-y-6">
                       <div className="flex gap-4">
                          <div className="w-6 h-6 bg-background border border-border rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                          <p className="text-sm text-foreground/80">Arrive at the workshop at your booked drop-off time.</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 bg-background border border-border rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                          <p className="text-sm text-foreground/80">Hand your keys to reception and confirm your booking reference.</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 bg-background border border-border rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                          <p className="text-sm text-foreground/80">We'll notify you via SMS when collection is ready.</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button onClick={() => setStep(5)} className="p-2 hover:bg-card rounded-full transition-all">
                <ArrowLeft size={24} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tighter">Finalise Booking</h2>
                <p className="text-sm sm:text-base text-muted">Drop off on {selectedDate} @ {selectedTime}.</p>
              </div>
            </div>

            <div className="space-y-8">
              <Card className="p-8 bg-card border-border shadow-xl space-y-8">
                <div className="flex justify-between items-center border-b border-border pb-6">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest">Vehicle</span>
                  <span className="text-lg font-black text-foreground">{vehicle?.year} {vehicle?.make} {vehicle?.model}</span>
                </div>
                
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest block">Job Breakdown</span>
                  {selectedServices.map(id => {
                    const service = SERVICES.find(s => s.id === id);
                    if (!service) return null;
                    const isTransmission = id === 'transmission';
                    const matchedPkg = mechanicPackages.find((p: any) => isTransmission ? p.pkg_type === 'transmission' : p.pkg_type === 'standard');
                    const displayPrice = matchedPkg ? (matchedPkg.calculatedPrice || matchedPkg.price) : priceFor(id);
                    return (
                      <div key={id} className="space-y-3 bg-background/50 p-4 rounded-2xl border border-border">
                        <div className="flex justify-between items-center text-foreground">
                          <span className="text-sm font-black uppercase tracking-tight">{matchedPkg ? matchedPkg.name : service.name}</span>
                          <span className="text-sm font-black">${displayPrice}</span>
                        </div>
                        {matchedPkg ? (
                          <div className="border-t border-border/50 pt-3 space-y-1.5">
                            {matchedPkg.base_fee != null && (
                              <div className="flex justify-between text-[11px] text-muted font-medium">
                                <span>Labour / base</span><span>${matchedPkg.base_fee}</span>
                              </div>
                            )}
                            {matchedPkg.pkg_type === 'standard' && matchedPkg.oil_cost_per_l != null && (
                              <div className="flex justify-between text-[11px] text-muted font-medium">
                                <span>{matchedPkg.vehicleOilCapacity ?? matchedPkg.oil_litres ?? '?'}L {matchedPkg.oil_grade || 'oil'} @${matchedPkg.oil_cost_per_l}/L{matchedPkg.vehicleOilCapacity ? ' (vehicle spec)' : ''}</span>
                                <span>${((matchedPkg.vehicleOilCapacity ?? matchedPkg.oil_litres ?? 0) * matchedPkg.oil_cost_per_l).toFixed(2)}</span>
                              </div>
                            )}
                            {matchedPkg.filter_cost != null && matchedPkg.pkg_type === 'standard' && (
                              <div className="flex justify-between text-[11px] text-muted font-medium">
                                <span>Oil filter</span><span>${matchedPkg.filter_cost}</span>
                              </div>
                            )}
                            {matchedPkg.pkg_type === 'transmission' && matchedPkg.trans_oil_cost_per_l != null && (
                              <div className="flex justify-between text-[11px] text-muted font-medium">
                                <span>{matchedPkg.trans_oil_litres ?? '?'}L trans fluid @${matchedPkg.trans_oil_cost_per_l}/L</span>
                                <span>${((matchedPkg.trans_oil_litres ?? 0) * matchedPkg.trans_oil_cost_per_l).toFixed(2)}</span>
                              </div>
                            )}
                            {matchedPkg.freight != null && <div className="flex justify-between text-[11px] text-muted font-medium"><span>Freight</span><span>${matchedPkg.freight}</span></div>}
                            {matchedPkg.scan_tool_fee != null && <div className="flex justify-between text-[11px] text-muted font-medium"><span>Scan tool</span><span>${matchedPkg.scan_tool_fee}</span></div>}
                            {Array.isArray(matchedPkg.included_items) && matchedPkg.included_items.length > 0 && (
                              <div className="pt-2 border-t border-border/30">
                                <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5">Included</p>
                                {matchedPkg.included_items.map((item: string, i: number) => (
                                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                                    <span>✓</span><span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {vehicleOilType && matchedPkg.pkg_type === 'standard' && (
                              <p className="text-[10px] text-torqued-red/70 italic pt-1">Approved oil for your vehicle: {vehicleOilType}</p>
                            )}
                          </div>
                        ) : (
                          <>
                            {service.parts && (
                              <div className="pl-0 space-y-1.5 border-t border-border/50 pt-3">
                                {service.parts.map(p => (
                                  <div key={p.id} className="flex justify-between text-[11px] text-muted font-medium">
                                    <span>{p.name} (x{p.quantity})</span><span>${p.total.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {service.labour && (
                              <div className="pl-0 space-y-1.5">
                                {service.labour.map(l => (
                                  <div key={l.id} className="flex justify-between text-[11px] text-muted font-medium">
                                    <span>Labour • {l.name}</span><span>${l.cost.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center py-6 border-t border-b border-border">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest">Total Estimate (incl. GST)</span>
                  <span className="text-4xl font-black text-torqued-red tracking-tighter">${selectedMechanic?.estimatedPrice}</span>
                </div>
                {isRepairFromDiagnostic && (
                  <div className="pt-2">
                    <p className="text-[10px] text-emerald-600 font-bold bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 italic leading-relaxed text-center">
                      * $99 Diagnostic Fee from previous visit was already paid and is excluded from this quote.
                    </p>
                  </div>
                )}

                {hasMBI && mbiStatus === 'pre-approved' && !isClaimApproved && (
                  <div className="pt-4 space-y-5 bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                    <div className="flex items-center gap-3">
                       <div className="bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg shadow-emerald-500/20">
                          <CheckCircle2 size={16} />
                       </div>
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Pre-Approved Provident Claim</label>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Claim Number</label>
                        <Input 
                          placeholder="CL-998877" 
                          value={claimNumber}
                          onChange={(e) => setClaimNumber(e.target.value)}
                          className="bg-card border-border h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Date of Birth</label>
                        <Input 
                          type="text"
                          placeholder="DD/MM/YYYY" 
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="bg-card border-border h-12"
                        />
                      </div>
                    </div>

                    <Button 
                      fullWidth 
                      size="lg" 
                      className="bg-emerald-600 hover:bg-emerald-700 h-14 text-white uppercase tracking-widest text-[10px] font-black rounded-2xl shadow-xl shadow-emerald-600/20"
                      disabled={!claimNumber || !dob}
                      onClick={() => setIsClaimApproved(true)}
                    >
                      Verify & Link Claim
                    </Button>
                    
                    <p className="text-[10px] text-emerald-600/60 font-medium leading-relaxed text-center max-w-xs mx-auto">
                      Your mechatronics unit repair was pre-approved. Verifying will deduct the covered amount from your total.
                    </p>
                  </div>
                )}

                {hasMBI && mbiStatus === 'not-claimed' && (
                  <div className="pt-4 space-y-4 bg-torqued-red/5 p-6 rounded-3xl border border-torqued-red/10 italic">
                    <div className="flex items-center gap-3 mb-1">
                       <Info size={18} className="text-torqued-red" />
                       <span className="text-[10px] font-black uppercase text-torqued-red tracking-widest">Insurance Claim Required</span>
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">
                      We'll submit this $6,997 quote to Provident Insurance for approval on your behalf. Your booking will remain <span className="font-black text-torqued-red uppercase">Pending Insurance Approval</span> until processed.
                    </p>
                  </div>
                )}

                {isClaimApproved && (
                  <div className="pt-4 space-y-4">
                    <div className="p-6 bg-emerald-500 text-white rounded-3xl flex items-center justify-between shadow-2xl shadow-emerald-500/20 border-core border-background -mx-2">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">MBI Approved</p>
                          <p className="font-black text-xl leading-none">Claim {claimNumber}</p>
                       </div>
                       <div className="text-right space-y-1">
                          <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">Covered</p>
                          <p className="font-black text-xl text-emerald-100 leading-none">$6,547.00</p>
                       </div>
                    </div>
                    <div className="flex justify-between items-center px-2 pt-2">
                      <span className="text-[10px] font-black uppercase text-muted tracking-widest">Excess to Pay Today</span>
                      <span className="text-3xl font-black text-emerald-500 tracking-tighter">$450.00</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Promo Code Box */}
              <div className="p-6 bg-card border border-border/70 rounded-3xl space-y-3.5 shadow-md">
              </div>


              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted block">Direct Secure Payments (Via Stripe)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: 'Credit or Debit Card', icon: <CreditCard size={18} />, color: 'bg-blue-600', internalName: 'Credit or Debit Card' },
                      { name: 'Afterpay', icon: <span className="text-[10px] font-black italic leading-none">ap</span>, color: 'bg-emerald-400', internalName: 'Afterpay' },
                      { name: 'Klarna', icon: <span className="text-[10px] font-black italic leading-none">K.</span>, color: 'bg-pink-400', internalName: 'Klarna' },
                    ].map(method => (
                      <button 
                        key={method.name} 
                        type="button"
                        onClick={() => setPaymentMethod(method.internalName)}
                        className={cn(
                          "p-5 border rounded-2xl flex flex-col items-center gap-3 transition-all relative group cursor-pointer",
                          paymentMethod === method.internalName ? "border-torqued-red bg-torqued-red text-white shadow-xl shadow-torqued-red/20" : "border-border bg-card hover:border-torqued-red/30"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                          paymentMethod === method.internalName ? "bg-white text-torqued-red" : `${method.color} text-white`
                        )}>
                          {method.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tight text-center">{method.name}</span>
                        {paymentMethod === method.internalName && <div className="absolute top-2 right-2"><CheckCircle2 size={12} /></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted block">Financing Options</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: 'Finance Now', icon: <span className="text-[10px] font-black leading-none">FN</span> },
                      { name: 'Latitude', icon: <span className="text-[10px] font-black leading-none">L</span> },
                      { name: 'Q Card', icon: <span className="text-[10px] font-black leading-none">Q</span> },
                    ].map(method => (
                      <div 
                        key={method.name} 
                        className="p-5 border border-dashed border-border/80 bg-background/30 rounded-2xl flex flex-col items-center justify-center gap-2.5 relative select-none opacity-50 cursor-not-allowed"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-muted border border-border bg-muted/20">
                          {method.icon}
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-tight text-muted">{method.name}</p>
                          <span className="inline-block mt-1 text-[8px] bg-foreground/10 text-muted px-1.5 py-0.5 rounded font-black uppercase tracking-widest leading-none">
                            Coming Soon
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button 
                fullWidth 
                size="lg" 
                disabled={!paymentMethod || isBookingLoading} 
                onClick={handleBooking} 
                className="h-16 text-lg rounded-2xl bg-torqued-red text-white shadow-2xl shadow-torqued-red/20 uppercase tracking-widest font-black flex items-center justify-center gap-3"
              >
                {isBookingLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  paymentMethod === 'Finance Now' ? 'Apply for Finance Now' : 'Confirm & Secure Booking'
                )}
              </Button>
            </div>
          </motion.div>
        );

      case 7: {
        const isConfirmed = latestBooking?.paymentStatus === 'confirmed';
        const isPartiallyPaid = latestBooking?.paymentStatus === 'partially_paid';
        const isAwaitingApproval = latestBooking?.paymentStatus === 'awaiting_approval';
        
        let stepTitle = "Booking Requested!";
        let stepSubtitle = "Your reservation request is submitted and pending payment approval.";
        let iconBgColor = "bg-amber-500 shadow-amber-500/40";
        let iconElement = <Clock size={56} className="text-white" />;
        
        if (isConfirmed) {
          stepTitle = "Booking Confirmed!";
          stepSubtitle = "Your workshop has been notified and your slot is locked in.";
          iconBgColor = "bg-emerald-500 shadow-emerald-500/40";
          iconElement = <CheckCircle2 size={56} className="text-white" />;
        } else if (isPartiallyPaid) {
          stepTitle = "Deposit Processed!";
          stepSubtitle = "Your payment was successful. Your slot is locked in.";
          iconBgColor = "bg-emerald-500 shadow-emerald-500/40";
          iconElement = <CheckCircle2 size={56} className="text-white" />;
        } else if (isAwaitingApproval) {
          if (latestBooking?.paymentMethod === 'Finance Now') {
            stepTitle = "Application Sent!";
            stepSubtitle = "Your Finance Now application has been submitted. Your booking is reserved pending finance approval.";
            iconBgColor = "bg-blue-500 shadow-blue-500/40";
            iconElement = <Monitor size={56} className="text-white" />;
          } else if (latestBooking?.paymentMethod === 'Provident Insurance') {
            stepTitle = "Claim Submitted!";
            stepSubtitle = "Your Provident Insurance claim details have been prepared. Your slot is reserved pending insurance clearance.";
            iconBgColor = "bg-purple-500 shadow-purple-500/40";
            iconElement = <Info size={56} className="text-white" />;
          }
        }

        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-12 text-center py-8"
          >
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className={`relative w-28 h-28 ${iconBgColor} rounded-full flex items-center justify-center mx-auto shadow-2xl border-4 border-background`}>
                {iconElement}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter">{stepTitle}</h2>
              <p className="text-muted text-lg">{stepSubtitle}</p>
            </div>

            <Card className="p-8 bg-card border-border text-left space-y-6 max-w-md mx-auto shadow-xl">
              <div className="flex justify-between items-center border-b border-border pb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Workshop</p>
                  <p className="text-lg font-bold">{selectedMechanic?.name}</p>
                </div>
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center border border-border">
                  <MapPin size={20} className="text-torqued-red" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Drop-off</p>
                  <p className="text-sm font-bold">{selectedDate}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Time</p>
                  <p className="text-sm font-bold">{selectedTime}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase text-muted tracking-widest">Payment Info</p>
                <div className="text-right">
                  <span className="text-xs font-bold text-foreground mr-2">{latestBooking?.paymentMethod || paymentMethod}</span>
                  {isConfirmed || isPartiallyPaid ? (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded font-black uppercase">PAID</span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded font-black uppercase">PENDING APPROVAL</span>
                  )}
                </div>
              </div>
            </Card>

            <div className="space-y-4 pt-4 max-w-md mx-auto">
              <div className="flex items-start gap-4 text-left p-6 bg-card rounded-2xl border border-border shadow-sm">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 font-bold text-xs text-emerald-500 border-emerald-500/30">1</div>
                <div>
                  <p className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                    Email Delivered Successfully
                    <span className="text-[10px] uppercase font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded">Verified</span>
                  </p>
                  <p className="text-xs text-muted">A beautiful HTML layout confirmation was sent matching our design language.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left p-6 bg-card rounded-2xl border border-border shadow-sm">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                <div>
                  <p className="text-sm font-bold">SMS Confirmation Sent</p>
                  <p className="text-xs text-muted">You'll receive a reminder 24h before your booking.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 text-left p-6 bg-card rounded-2xl border border-border shadow-sm">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                <div>
                  <p className="text-sm font-bold">Drop-off Directions</p>
                  <p className="text-xs text-muted">Open your garage in the app for drop-off details on arrival.</p>
                </div>
              </div>
            </div>

            {/* Email Preview Terminal Button */}
            {emittedEmailHtml && (
              <div className="p-5 bg-card border border-border max-w-md mx-auto rounded-2xl text-left space-y-3.5 shadow-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted leading-none">High-Fidelity Document</span>
                    <h4 className="text-xs font-bold text-foreground leading-none">CONFIRMATION RECEIPT READY</h4>
                  </div>
                </div>
                <p className="text-[11.5px] text-muted leading-relaxed font-semibold">
                  We've rendered the gorgeous confirmation email matching the brand styling. Direct SMTP relays can be configured in settings.
                </p>
                <Button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[10.5px] h-10 rounded-xl"
                >
                  View Dispatched Email Layout
                </Button>
              </div>
            )}

            <div className="pt-8 space-y-6 max-w-md mx-auto">
              <Button 
                fullWidth 
                size="lg" 
                className="bg-torqued-red shadow-xl shadow-torqued-red/20 text-white text-lg h-16 rounded-2xl"
                onClick={() => {
                  setStep(1);
                  setView('dashboard');
                }}
              >
                Go to My Garage →
              </Button>
              <button 
                className="w-full text-xs font-bold uppercase tracking-[0.2em] text-muted hover:text-foreground transition-colors"
                onClick={() => {
                  setVehicle(null);
                  setRego('');
                  setStep(1);
                  setView('quote');
                }}
              >
                + Add Another Vehicle
              </button>
            </div>
          </motion.div>
        );
      }

      default:
        return null;
    }
  };

  const [isManagingGarage, setIsManagingGarage] = useState(false);
  const ARCHIVE_KEY = 'torqued_archived_regos';
  const [archivedRegos, setArchivedRegos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
  });
  const [showArchived, setShowArchived] = useState(false);
  const toggleArchive = (rego: string) => {
    setArchivedRegos(prev => {
      const next = prev.includes(rego) ? prev.filter(r => r !== rego) : [...prev, rego];
      try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const renderDashboard = () => {
    // Gate: My Garage requires a verification (passkey or magic link) within the last 48h, on this browser
    if (!garageUnlocked) {
      return (
        <div className="max-w-md mx-auto py-10">
          <Card className="p-8 space-y-5 bg-card border-border text-center shadow-md">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red"><Lock size={22} /></div>
            <div className="space-y-1.5">
              <h3 className="text-2xl font-black tracking-tight">Verify it's you</h3>
              <p className="text-sm text-muted">For your security, access to My Garage expires after 48 hours and on new devices. Enter your plate to verify with a passkey or a secure email link.</p>
            </div>
            <div className="space-y-3">
              <Input value={rego} onChange={e => setRego(e.target.value.toUpperCase())} placeholder="Number plate (e.g. RAH190)" className="text-center text-lg font-black tracking-widest" />
              {plateMatchError && <p className="text-xs text-torqued-red font-bold">{plateMatchError}</p>}
              {passkeysSupported() && (
                <Button fullWidth className="bg-torqued-red text-white" disabled={!rego || magicVerifying} onClick={() => verifyWithPasskey(rego.toUpperCase().trim())}>
                  🔑 Verify with Face / Touch ID
                </Button>
              )}
              {passkeyError && <p className="text-xs text-torqued-red font-bold">{passkeyError}</p>}
              <Button fullWidth variant="outline" disabled={!rego || isSearchingRego} onClick={handleRegoLookup}>
                Email me a secure link instead
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              G'day, {userName || 'Sri'} 👋 <br />
              <span className="text-muted text-xl sm:text-2xl tracking-tight">Your garage.</span>
            </h2>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[10px] uppercase tracking-widest font-black border border-border text-muted hover:text-torqued-red hover:bg-torqued-red/5 px-4"
                onClick={() => setIsManagingGarage(true)}
              >
                Manage My Garage
              </Button>
            </div>
          </div>
          <div className="w-12 h-12 bg-torqued-red rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-torqued-red/20 border border-white/20">
            {(userName || 'S').charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Passkey setup for existing customers who don't yet have one */}
        {passkeysSupported() && passkeyCardState !== 'added' && (
          <Card className="p-4 bg-torqued-red/5 border-torqued-red/20 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">🔑 Faster, safer sign-in</p>
              <p className="text-xs text-muted mt-0.5">{passkeyCardState === 'error' ? 'Could not add a passkey — try again.' : 'Add a passkey to open My Garage with Face / Touch ID next time.'}</p>
            </div>
            <Button size="sm" className="bg-torqued-red text-white shrink-0" disabled={passkeyCardState === 'adding'} onClick={async () => {
              const plate = (rego || vehicle?.rego || garageVehicles[0]?.rego || '').toUpperCase();
              if (!plate) return;
              setPasskeyCardState('adding');
              try { await registerPasskey('customer', plate); setPasskeyCardState('added'); }
              catch { setPasskeyCardState('error'); }
            }}>{passkeyCardState === 'adding' ? 'Adding…' : 'Add passkey'}</Button>
          </Card>
        )}

        {/* Manage Garage Modal */}
        <AnimatePresence>
          {isManagingGarage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsManagingGarage(false)}
                className="absolute inset-0 bg-background/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden"
              >
                <div className="p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black tracking-tighter">Manage Garage</h3>
                      <p className="text-sm text-muted">Update your profile and shop preferences.</p>
                    </div>
                    <button 
                      onClick={() => setIsManagingGarage(false)}
                      className="p-2 hover:bg-background rounded-full transition-all"
                    >
                      <Plus className="rotate-45" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest">Display Name</label>
                      <Input 
                        value={userName || 'Sri'} 
                        onChange={(e) => setUserName(e.target.value)}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest">Home Location</label>
                      <Input 
                        placeholder="e.g. Grey Lynn, Auckland" 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest">Notification Preferences</label>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-border">
                          <span className="text-xs font-bold">SMS reminders for bookings</span>
                          <div className="w-10 h-5 bg-torqued-red rounded-full relative">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-border">
                          <span className="text-xs font-bold">Maintenance alerts</span>
                          <div className="w-10 h-5 bg-torqued-red rounded-full relative">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button 
                    fullWidth 
                    size="lg" 
                    className="bg-torqued-red text-white h-14 rounded-2xl shadow-xl shadow-torqued-red/20 uppercase tracking-widest font-black text-[10px]"
                    onClick={async () => {
                      if (user) {
                        await updateProfile({ name: userName || 'Sri', homeLocation: location });
                      }
                      setIsManagingGarage(false);
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold tracking-tight">My Vehicles</h3>
            </div>

            {vehicle && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Currently viewing:</span>
                <span className="font-black text-foreground">{vehicle.make} {vehicle.model}</span>
                <span className="torqued-badge text-[10px]">{vehicle.rego}</span>
              </div>
            )}

            <div className="space-y-3">
              {(() => {
                const base = garageVehicles.length > 0 ? garageVehicles : (vehicle ? [vehicle] : []);
                const list = base.filter(gv => showArchived ? archivedRegos.includes(gv.rego) : !archivedRegos.includes(gv.rego));
                return list.map(gv => {
                const isActive = vehicle?.rego === gv.rego;
                const isArchived = archivedRegos.includes(gv.rego);
                return (
                  <Card
                    key={gv.rego}
                    onClick={() => !isArchived && selectGarageVehicle(gv.rego)}
                    className={cn(
                      "p-4 flex items-center gap-4 transition-all",
                      isArchived ? "opacity-60 border-border" : "cursor-pointer active:scale-[0.99]",
                      isActive ? "border-torqued-red ring-2 ring-torqued-red bg-torqued-red/5" : "liquid-glass border-white/10 hover:border-torqued-red/30"
                    )}
                  >
                    {gv.thumbnail
                      ? <img src={gv.thumbnail} alt="Car" className="w-20 h-20 rounded-xl object-cover ring-1 ring-white/10" />
                      : <div className="w-20 h-20 rounded-xl bg-card flex items-center justify-center ring-1 ring-white/10"><Car size={28} className="text-muted" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="torqued-badge text-[10px]">{gv.rego}</div>
                        {isActive && <span className="text-[9px] font-black uppercase bg-torqued-red text-white px-2 py-0.5 rounded-full tracking-widest">✓ Selected</span>}
                      </div>
                      <h4 className="text-lg leading-none font-bold truncate">{gv.year} {gv.make} {gv.model}</h4>
                      <p className="text-xs text-muted mt-1">{gv.variant}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleArchive(gv.rego); }}
                      className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-torqued-red shrink-0 px-2"
                    >{isArchived ? 'Restore' : 'Archive'}</button>
                  </Card>
                );
                });
              })()}

              {garageVehicles.length === 0 && !vehicle && (
                <p className="text-sm text-muted text-center py-4">No vehicles yet. Add one below to start tracking its history.</p>
              )}

              {archivedRegos.length > 0 && (
                <button onClick={() => setShowArchived(s => !s)} className="w-full text-xs font-bold text-muted hover:text-foreground py-2">
                  {showArchived ? '← Back to active vehicles' : `View archived (${archivedRegos.length})`}
                </button>
              )}

              <button
                onClick={() => {
                  setVehicle(null);
                  setRego('');
                  setVehiclePrices({});
                  setStep(1);
                  setView('quote');
                }}
                className="w-full p-4 border border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all text-sm font-bold active:scale-[0.98]"
              >
                <Plus size={16} /> Add Another Vehicle
              </button>
            </div>
          </section>

              <section className="space-y-6">
                <div className="flex justify-between items-center gap-3">
                  <h3 className="text-2xl font-bold tracking-tight">Service History</h3>
                  <div className="flex gap-2">
                    <input id="history-upload-input" type="file" accept="image/*,application/pdf" multiple className="hidden"
                      onChange={(e) => { handleMultiUpload(Array.from(e.target.files || [])); e.target.value = ''; }} />
                    <Button variant="outline" size="sm"
                      className="text-torqued-red border-torqued-red/20 hover:bg-torqued-red/5"
                      onClick={() => document.getElementById('history-upload-input')?.click()}>
                      <Upload size={16} className="mr-1" /> Upload (AI)
                    </Button>
                    <Button variant="outline" size="sm"
                      className="text-foreground border-border hover:bg-background"
                      onClick={() => setShowHistoryEntry(true)}>
                      <Plus size={16} className="mr-1" /> Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {manualHistory.length === 0 && (
                    <Card className="p-6 bg-card border-border text-center text-sm text-muted italic">No service history yet for this vehicle. Tap “Upload (AI)” to scan a receipt or “Add” to enter one.</Card>
                  )}
                  {manualHistory.map((history, idx) => {
                    const headline = histSummaries[history.service] || history.service;
                    return (
                    <Card key={idx} className="p-4 bg-card border-border group hover:border-torqued-red/30 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="w-10 h-10 shrink-0 bg-background rounded-xl flex items-center justify-center border border-border group-hover:bg-torqued-red/10 group-hover:border-torqued-red/20 transition-all">
                            <Clock size={16} className="text-muted group-hover:text-torqued-red transition-all" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold">{headline}</h4>
                            <p className="text-[10px] text-muted uppercase font-black tracking-widest">{history.date}{history.provider ? ` • ${history.provider}` : ''}</p>
                            {history.notes && <p className="text-xs text-muted mt-1 leading-snug">{history.notes}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {history.mileage && <p className="text-xs font-mono text-muted">{Number(history.mileage).toLocaleString()} KM</p>}
                          {history.price && <p className="text-xs font-bold text-torqued-red mt-0.5">{String(history.price).startsWith('$') ? history.price : `$${history.price}`}</p>}
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[8px] font-bold text-emerald-400 uppercase">Verified</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                    );
                  })}
                </div>
              </section>

              {/* Vehicle Photos */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold tracking-tight">Vehicle Photos</h3>
                  <label className="cursor-pointer">
                    <span className="text-xs font-bold text-torqued-red border border-torqued-red/30 rounded-lg px-3 py-1.5 hover:bg-torqued-red/5 flex items-center gap-1">
                      <Upload size={12} /> {photoUploading ? 'Uploading…' : 'Upload Photo'}
                    </span>
                    <input type="file" accept="image/*" className="hidden" disabled={photoUploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
                  </label>
                </div>
                <input
                  className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-torqued-red/50"
                  placeholder="Photo caption (optional — set before uploading)"
                  value={photoComment}
                  onChange={e => setPhotoComment(e.target.value)}
                />
                {vehiclePhotos.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted italic bg-card border-border">No photos yet. Upload images of your vehicle for reference.</Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {vehiclePhotos.map(photo => (
                      <div key={photo.id} className="space-y-1">
                        <img src={photo.photo_url} alt={photo.comment || 'photo'} className="w-full aspect-square object-cover rounded-xl border border-border" />
                        {photo.comment && <p className="text-[10px] text-muted truncate">{photo.comment}</p>}
                        <p className="text-[9px] text-muted/60">{new Date(photo.created_at).toLocaleDateString('en-NZ')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

          <section className="space-y-6">
            <h3 className="text-2xl font-bold tracking-tight">Active Jobs</h3>
            {activeJobs.length === 0 ? (
              <Card className="p-12 text-center text-muted italic bg-card border-border">No active jobs. Book a service to see it here.</Card>
            ) : (
              activeJobs.map(job => (
                <Card key={job.id} className="p-6 space-y-6 bg-card border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xl font-bold tracking-tight">{job.serviceIds.map(id => SERVICES.find(s => s.id === id)?.name).join(' & ')}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>at {[...realMechanics, ...MOCK_MECHANICS].find(m => m.id === job.mechanicId)?.name || 'your workshop'}</span>
                        <span>•</span>
                        {isEditingDate === job.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="date" 
                              className="bg-background border border-border rounded-xl px-2 py-1 outline-none text-foreground text-[10px] focus:border-torqued-red transition-all" 
                              value={newDate}
                              onChange={(e) => setNewDate(e.target.value)}
                            />
                            <button onClick={() => {
                              setActiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, date: newDate } : j));
                              setIsEditingDate(null);
                            }} className="text-torqued-red font-bold">Save</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span>{job.date}</span>
                            <button onClick={() => {
                              setIsEditingDate(job.id);
                              setNewDate(job.date);
                            }} className="p-1 hover:bg-background rounded">
                              <Edit2 size={12} className="text-muted" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded",
                        job.paymentStatus === 'confirmed' ? "bg-emerald-500/10 text-emerald-400" : 
                        job.paymentStatus === 'awaiting_approval' ? "bg-indigo-500/10 text-indigo-400" :
                        "bg-torqued-red/10 text-torqued-red"
                      )}>
                        {job.paymentStatus === 'confirmed' ? 'Confirmed' : 
                         job.paymentStatus === 'awaiting_approval' ? 'Pending Approval' : 
                         'Partially Paid'}
                      </span>
                      <p className="text-[10px] text-muted mt-1 uppercase font-bold tracking-widest">{job.paymentMethod}</p>
                    </div>
                  </div>

                  {job.serviceIds.includes('diag_inspection') && (
                    <div className="p-4 bg-torqued-red/5 border border-torqued-red/15 rounded-2xl flex items-start gap-3">
                      <Info size={16} className="text-torqued-red mt-0.5 shrink-0" />
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        <span className="font-bold">Diagnostic Inspection booked.</span> We'll let you know once the mechanic has diagnosed your vehicle, and you'll be able to review and accept your quote right here.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-muted">
                      <span>Booked</span>
                      <span>In Progress</span>
                      <span>Ready</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '20%' }}
                        className="h-full bg-torqued-red"
                      />
                    </div>
                  </div>

                  {/* Itemised quote (parts + labour) — loaded on demand from the booking detail */}
                  {(() => {
                    const d = jobDetail[job.id];
                    const qi = d?.quoteItems;
                    if (!qi) return null;
                    const parts = Array.isArray(qi.parts) ? qi.parts.filter((p: any) => p.name) : [];
                    const labourTotal = (qi.labourHours || 0) * (qi.labourRate || 0);
                    return (
                      <div className="pt-4 border-t border-border space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Itemised Quote</p>
                        {parts.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-foreground/80">{p.name}{p.qty > 1 ? ` ×${p.qty}` : ''}</span>
                            <span className="font-mono">${((p.unitPrice || 0) * (p.qty || 1)).toFixed(2)}</span>
                          </div>
                        ))}
                        {labourTotal > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-foreground/80">Labour ({qi.labourHours}h @ ${qi.labourRate}/hr)</span>
                            <span className="font-mono">${labourTotal.toFixed(2)}</span>
                          </div>
                        )}
                        {d?.total > 0 && (
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                            <span>Total (GST incl.)</span>
                            <span className="text-torqued-red font-mono">${Number(d.total).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reschedule editor (business-day date + workshop time slots, like the initial booking) */}
                  {reschedJob === job.id && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted">Reschedule drop-off</p>
                      <input type="date" min={new Date().toISOString().slice(0, 10)} value={reschedDate}
                        onChange={(e) => setReschedDate(e.target.value)}
                        className="bg-background border border-border rounded-xl px-3 py-2 outline-none text-foreground text-sm focus:border-torqued-red w-full" />
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {RESCHED_SLOTS.map(t => (
                          <button key={t} onClick={() => setReschedTime(t)}
                            className={cn("p-2 rounded-lg border text-[11px] font-bold transition-all",
                              reschedTime === t ? "border-torqued-red bg-torqued-red text-white" : "border-border bg-card text-muted hover:border-torqued-red/30")}>{t}</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!reschedDate || jobBusy === job.id} onClick={() => saveReschedule(job)} className="bg-torqued-red">{jobBusy === job.id ? 'Saving…' : 'Save new time'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReschedJob(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border flex flex-wrap gap-2 justify-end">
                    {job.paymentStatus !== 'awaiting_approval' && (
                      <Button size="sm" variant="outline"
                        className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                        onClick={() => { setReschedJob(reschedJob === job.id ? null : job.id); setReschedDate((job.date || '').slice(0, 10)); loadJobDetail(job); }}>
                        <Edit2 size={14} className="text-torqued-red" /> Reschedule
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                      disabled={jobBusy === job.id}
                      onClick={() => cancelJob(job)}>
                      <X size={14} className="text-torqued-red" /> Cancel booking
                    </Button>
                    <Button size="sm" variant="outline"
                      className="border-border text-foreground hover:bg-background flex items-center gap-1.5 h-9 rounded-xl font-bold text-xs"
                      onClick={() => generateBookingPDF(job)}>
                      <Download size={14} className="text-torqued-red" /> Download Quote PDF
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </section>

          {/* Ask Torqued AI — customer diagnostic assistant */}
          <section className="space-y-4">
            <Card className="p-6 bg-gradient-to-br from-torqued-red/10 to-card border-torqued-red/20 flex items-center gap-4 cursor-pointer hover:border-torqued-red/40 transition-all"
              onClick={() => setChatOpen(true)}>
              <div className="w-12 h-12 rounded-2xl bg-torqued-red/15 flex items-center justify-center shrink-0">
                <Sparkles size={22} className="text-torqued-red" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold">Ask Torqued AI</h4>
                <p className="text-sm text-muted">Not sure what's wrong? Describe it and get tailored help, then book.</p>
              </div>
              <ChevronRight size={20} className="text-muted shrink-0" />
            </Card>
          </section>

          {(() => {
            // Map a maintenance item to a bookable service id
            const itemToService = (name: string): string | null => {
              const n = name.toLowerCase();
              if (n.includes('wof')) return 'wof';
              if (n.includes('timing') || n.includes('cambelt')) return 'timing';
              if (n.includes('oil')) return 'oil';
              if (n.includes('brake')) return 'brakes_front_pads';
              if (n.includes('spark')) return 'spark_plugs';
              if (n.includes('battery')) return 'battery';
              if (n.includes('transmission') || n.includes('dsg') || n.includes('dct')) return 'transmission';
              return null;
            };
            // Only show items that are upcoming/not recently completed
            const dueItems = userServiceItems.filter(it => {
              if (!it.lastDoneDate) return true;
              const months = it.intervalMonths || 12;
              const last = new Date(it.lastDoneDate).getTime();
              return Date.now() - last > (months - 2) * 30 * 864e5; // due within ~2 months
            });
            const costRange = (sid: string | null) => {
              if (!sid) return null;
              const base = priceFor(sid);
              if (!base) return null;
              const high = Math.round(base * 1.3 / 5) * 5;
              return `$${base} – $${high}`;
            };
            return (
              <section className="space-y-6">
                <h3 className="text-2xl font-bold tracking-tight">Maintenance Schedule</h3>
                <p className="text-sm text-muted -mt-3">Upcoming or due services for your {vehicle?.make} {vehicle?.model}. Tap one to get a quote and book.</p>
                <div className="space-y-3">
                  {dueItems.length === 0 && <Card className="p-8 text-center text-muted italic bg-card border-border">You're all up to date — no services due soon. 🎉</Card>}
                  {dueItems.map(item => {
                    const sid = itemToService(item.name);
                    const range = costRange(sid);
                    return (
                      <Card key={item.id} onClick={() => {
                        if (!sid) return;
                        setSelectedServices([sid]); setQuotePath('service'); setView('quote'); setStep(3);
                      }} className={cn("p-4 flex items-center justify-between gap-4 bg-card border-border transition-all", sid ? "cursor-pointer hover:border-torqued-red/40 active:scale-[0.99]" : "")}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-torqued-red/10 flex items-center justify-center text-torqued-red"><Wrench size={16} /></div>
                          <div>
                            <p className="font-bold text-sm">{item.name}</p>
                            <p className="text-[11px] text-muted">{item.intervalMileage ? `Due at ${item.intervalMileage.toLocaleString()} km` : 'Due soon'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-torqued-red text-sm">{range || 'Get quote'}</p>
                          {sid && <p className="text-[10px] text-muted uppercase font-bold tracking-widest flex items-center gap-1 justify-end">Book <ChevronRight size={11} /></p>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <div className="p-3 bg-torqued-red/5 text-[10px] text-torqued-red font-black uppercase tracking-widest text-center rounded-xl border border-torqued-red/10">
                  Estimates based on {vehicle?.make} {vehicle?.model} data · final price confirmed by your chosen workshop
                </div>
              </section>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 flex flex-col",
      "bg-background text-foreground"
    )}>
      <nav className="px-6 md:px-12 flex justify-between items-center h-20 sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border relative group transition-all">
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-torqued-red/30 to-transparent" />
        
        <Logo variant={theme === 'dark' ? 'light' : 'dark'} />
        <div className="flex gap-4 items-center">
          <div className="hidden sm:flex bg-card p-1 rounded-xl border border-border">
            {[
              { name: 'light', icon: Sun },
              { name: 'dark', icon: Moon },
              { name: 'system', icon: Monitor },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as any)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    theme === t.name 
                      ? "bg-torqued-red text-white shadow-lg shadow-torqued-red/20" 
                      : "text-muted hover:text-foreground hover:bg-background"
                  )}
                  title={t.name.charAt(0).toUpperCase() + t.name.slice(1)}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0 hidden md:block">
             <button className="text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-torqued-red px-4 py-2 transition-colors">
               Mechanic Login / Sign Up
             </button>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-foreground hover:text-torqued-red hover:bg-card rounded-full px-6 font-bold uppercase tracking-widest text-[10px] border-border transition-all" 
            onClick={() => {
              setStep(1);
              setView(view === 'quote' ? 'dashboard' : 'quote');
            }}
          >
            {view === 'quote' ? <><Car size={16} className="mr-2" /> My Garage</> : <><Wrench size={16} className="mr-2" /> Get Quote</>}
          </Button>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 py-8 md:py-16">
        <AnimatePresence mode="wait">
          {view === 'quote' ? renderStep() : renderDashboard()}
        </AnimatePresence>
      </main>

      {/* Verification overlay for registered plates */}
      <AnimatePresence>
        {showVerificationRequired && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVerificationRequired(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden text-center p-8 space-y-6"
            >
              <div className="w-16 h-16 bg-torqued-red/10 text-torqued-red rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Lock size={32} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tighter leading-tight text-foreground">Car History Locked 🔒</h3>
                <p className="text-sm text-muted text-balance mx-auto">
                  This vehicle's records are protected on Torqued. To proceed and schedule services, verify your email login.
                </p>
              </div>

              <div className="p-4 bg-background/50 border border-border rounded-xl text-left space-y-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-muted">Awaiting Verification Owner</span>
                <p className="text-xs font-bold text-foreground truncate">{verifiedEmailTarget || 'S**@g****.com'}</p>
              </div>

              <div className="space-y-3">
                <Button
                  fullWidth
                  size="lg"
                  className="bg-torqued-red text-white uppercase tracking-widest font-black text-[10px] h-12"
                  onClick={() => {
                    setShowVerificationRequired(false);
                    setTimeout(() => handleRegoLookup(), 100);
                  }}
                >
                  Try Again
                </Button>
                <Button 
                  variant="ghost" 
                  fullWidth 
                  className="text-[10px] text-muted tracking-widest uppercase font-black hover:text-foreground h-10"
                  onClick={() => setShowVerificationRequired(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Verified Review Modal */}
      <AnimatePresence>
        {reviewCtx && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-5 shadow-2xl text-center"
            >
              {reviewDone ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400"><CheckCircle2 size={32} /></div>
                  <h3 className="text-2xl font-black tracking-tight">Thanks for your review!</h3>
                  <p className="text-sm text-muted">Your verified review helps other NZ drivers choose with confidence.</p>
                  <Button fullWidth className="bg-torqued-red text-white" onClick={() => { setReviewCtx(null); setReviewDone(false); }}>Done</Button>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black tracking-tight">Rate your service</h3>
                  <p className="text-sm text-muted">How was your experience? Your review is verified against a real booking.</p>
                  <div className="flex justify-center gap-2 py-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setReviewRating(n)} className="transition-transform active:scale-90">
                        <Star size={36} className={n <= reviewRating ? 'text-yellow-400 fill-current' : 'text-muted/30'} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="Tell us about the work, communication, value… (optional)"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red min-h-[90px]"
                  />
                  <div className="flex gap-3">
                    <Button fullWidth className="bg-torqued-red text-white" onClick={async () => {
                      try {
                        await fetch('/api/reviews/submit', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bookingId: reviewCtx.bookingId, mechanicId: reviewCtx.mechanicId, rating: reviewRating, comment: reviewComment, email: customerEmail, name: userName }),
                        });
                        setReviewDone(true);
                      } catch {}
                    }}>Submit Review</Button>
                    <Button variant="ghost" onClick={() => setReviewCtx(null)}>Skip</Button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Customer Registration Modal */}
      <AnimatePresence>
        {showNewCustomerForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">Welcome to Torqued</h3>
                <p className="text-sm text-muted">We found your plate in our system. Enter your details to create your account.</p>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="First name"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={newCustomerEmail}
                  onChange={e => setNewCustomerEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
                <input
                  type="tel"
                  placeholder="Phone number (e.g. 021 123 4567)"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 h-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-torqued-red"
                />
              </div>

              {newCustomerError && (
                <p className="text-xs text-torqued-red font-bold">{newCustomerError}</p>
              )}

              <div className="flex gap-3">
                <Button
                  fullWidth
                  disabled={newCustomerLoading}
                  className="bg-torqued-red text-white"
                  onClick={async () => {
                    if (!newCustomerName || !newCustomerEmail) {
                      setNewCustomerError('Name and email are required.');
                      return;
                    }
                    setNewCustomerLoading(true);
                    setNewCustomerError(null);
                    try {
                      const res = await fetch('/api/customer/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rego: rego.toUpperCase().trim(),
                          name: newCustomerName,
                          email: newCustomerEmail,
                          phone: newCustomerPhone,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) { setNewCustomerError(data.error || 'Registration failed'); return; }
                      setUserName(newCustomerName);
                      setCustomerEmail(newCustomerEmail);
                      setShowNewCustomerForm(false);
                      setMagicSentTo(data.maskedEmail || newCustomerEmail);
                      setMagicFallbackLink(data.fallbackLink || null);
                    } catch {
                      setNewCustomerError('Could not connect. Please try again.');
                    } finally {
                      setNewCustomerLoading(false);
                    }
                  }}
                >
                  {newCustomerLoading ? 'Creating account...' : 'Get Started →'}
                </Button>
                <Button variant="ghost" onClick={() => setShowNewCustomerForm(false)}>Cancel</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Magic-link verifying overlay */}
      <AnimatePresence>
        {magicVerifying && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-torqued-dark">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-torqued-red border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white/60 font-bold text-sm uppercase tracking-widest">Verifying your link…</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch service-history review modal */}
      <AnimatePresence>
        {showBatchReview && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-card border border-border rounded-3xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Review imported records</h3>
                  <p className="text-xs text-muted">Edit anything the AI got wrong, remove unwanted rows, then save to your vehicle.</p>
                </div>
                <button onClick={() => { if (!batchSaving) { setShowBatchReview(false); setParsedBatch([]); } }} className="text-muted hover:text-foreground text-2xl leading-none">×</button>
              </div>

              {batchProgress && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                    <span>Reading files…</span><span>{batchProgress.done} / {batchProgress.total}</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-torqued-red transition-all" style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} /></div>
                </div>
              )}

              {parsedBatch.length === 0 && !batchProgress && <p className="text-sm text-muted italic text-center py-8">No records parsed.</p>}

              <div className="space-y-3">
                {parsedBatch.map(r => (
                  <div key={r.id} className="p-3 bg-background border border-border rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted/60 truncate">{r.fileName}</p>
                      <button onClick={() => removeBatchRecord(r.id)} className="text-torqued-red text-[10px] font-bold hover:underline">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={r.date} onChange={e => updateBatchRecord(r.id, 'date', e.target.value)} placeholder="Date" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.mileage} onChange={e => updateBatchRecord(r.id, 'mileage', e.target.value)} placeholder="Mileage (km)" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.service} onChange={e => updateBatchRecord(r.id, 'service', e.target.value)} placeholder="Work done" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs col-span-2" />
                      <input value={r.provider} onChange={e => updateBatchRecord(r.id, 'provider', e.target.value)} placeholder="Provider" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.price} onChange={e => updateBatchRecord(r.id, 'price', e.target.value)} placeholder="Price" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs" />
                      <input value={r.notes} onChange={e => updateBatchRecord(r.id, 'notes', e.target.value)} placeholder="Notes" className="bg-card border border-border rounded-lg px-2.5 h-9 text-xs col-span-2" />
                    </div>
                  </div>
                ))}
              </div>

              {receiptError && <p className="text-xs text-torqued-red font-bold">{receiptError}</p>}
              <div className="flex gap-3 pt-1">
                <Button variant="ghost" fullWidth disabled={batchSaving} onClick={() => { setShowBatchReview(false); setParsedBatch([]); }}>Cancel</Button>
                <Button fullWidth className="bg-torqued-red text-white" disabled={batchSaving || !!batchProgress || parsedBatch.length === 0} onClick={saveBatch}>
                  {batchSaving ? 'Saving…' : `Save ${parsedBatch.length} record${parsedBatch.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review-and-pay modal (opened from a quote QR / link) */}
      <AnimatePresence>
        {quoteReview && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-7 space-y-5 shadow-2xl"
            >
              <div className="text-center space-y-1">
                <div className="torqued-badge text-[10px] mx-auto">YOUR QUOTE IS READY</div>
                <h3 className="text-2xl font-black tracking-tight">{quoteReview.vehicleLabel || quoteReview.rego}</h3>
                {quoteReview.mechanicName && <p className="text-sm text-muted">Prepared by {quoteReview.mechanicName}</p>}
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                {(quoteReview.serviceIds || []).map((id: string) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="font-medium">{SERVICES.find(s => s.id === id)?.name || id}</span>
                    <span className="text-muted text-xs uppercase font-bold tracking-widest">Included</span>
                  </div>
                ))}
                {quoteReview.note && <p className="text-xs text-muted border-t border-border pt-2 mt-1">{quoteReview.note}</p>}
                <div className="flex justify-between items-end border-t border-border pt-3 mt-1">
                  <span className="text-xs font-black uppercase tracking-widest text-muted">Total (GST incl.)</span>
                  <span className="text-2xl font-black text-torqued-red">${Number(quoteReview.total).toFixed(2)}</span>
                </div>
              </div>

              {quoteReview.paymentStatus === 'confirmed' ? (
                <div className="text-center text-emerald-500 font-bold text-sm">✓ This quote has already been paid.</div>
              ) : (
                <Button fullWidth size="lg" className="bg-torqued-red text-white" disabled={quotePaying} onClick={payQuote}>
                  {quotePaying ? 'Opening secure checkout…' : 'Review & pay securely'}
                </Button>
              )}
              <p className="text-[11px] text-muted text-center">Flexible payment options (incl. Afterpay, Klarna) at checkout.</p>
              <button onClick={() => setQuoteReview(null)} className="w-full text-xs text-muted hover:text-foreground">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Magic-link sent modal */}
      <AnimatePresence>
        {magicSentTo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-8 space-y-5 text-center shadow-2xl"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-torqued-red/10 border border-torqued-red/20 flex items-center justify-center text-torqued-red text-3xl">✉️</div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">
                  {returningCustomerName ? `Welcome back, ${returningCustomerName}` : 'Check your email'}
                </h3>
                <p className="text-sm text-muted">
                  We've emailed a secure verification link to <span className="font-bold text-foreground">{magicSentTo}</span>. Tap it to access your vehicle — it expires in 15 minutes.
                </p>
              </div>
              {magicFallbackLink && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Email delivery is down — use this link to continue testing:</p>
                  <a href={magicFallbackLink} className="text-xs text-torqued-red font-bold break-all underline">{magicFallbackLink}</a>
                </div>
              )}
              {passkeysSupported() && (
                <>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted/50"><span className="flex-1 h-px bg-border" />faster<span className="flex-1 h-px bg-border" /></div>
                  <Button fullWidth className="bg-torqued-red text-white" onClick={() => verifyWithPasskey(rego)}>
                    🔑 Verify instantly with Face / Touch ID
                  </Button>
                  {passkeyError && <p className="text-xs text-torqued-red font-bold">{passkeyError}</p>}
                </>
              )}
              <Button variant="ghost" fullWidth onClick={() => { setMagicSentTo(null); setMagicFallbackLink(null); setPasskeyError(null); }}>Close</Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Verification Code OTP Modal (legacy — no longer triggered) */}
      <AnimatePresence>
        {showOTPModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOTPModal(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden p-8 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-torqued-red/10 border border-torqued-red/20 text-torqued-red rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <Lock size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tighter leading-tight text-foreground">
                  {returningCustomerName ? `Welcome back, ${returningCustomerName} 👋` : 'Check Your Email 🔐'}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  We sent a 6-digit verification code to
                </p>
                <div className="p-3 bg-muted/40 border border-border rounded-xl">
                  <p className="text-sm font-extrabold text-foreground truncate">{otpSentEmail}</p>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">
                  Enter the code from your email to continue.
                </p>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1">6-Digit Verification Code</label>
                <Input 
                  type="text" 
                  maxLength={6}
                  placeholder="E.G. 123456" 
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, ''));
                    setOtpVerificationError('');
                  }}
                  className="text-center text-3xl font-display font-black tracking-[0.3em] h-14 bg-background border-border text-foreground dark:text-white"
                />
                {otpVerificationError && (
                  <p className="text-xs font-bold text-torqued-red mt-1">{otpVerificationError}</p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  fullWidth
                  size="lg"
                  className="bg-torqued-red text-white uppercase tracking-widest font-black text-[10px] h-12"
                  onClick={handleConfirmOTP}
                >
                  Verify & Unlock History
                </Button>

                <div className="text-center">
                  {otpResendMsg && <p className="text-[10px] font-bold text-emerald-500 mb-1">{otpResendMsg}</p>}
                  <button
                    disabled={otpResendCooldown > 0}
                    onClick={async () => {
                      setOtpResendMsg(null);
                      setOtpVerificationError('');
                      try {
                        const r = await fetch('/api/customer/check-plate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ rego: rego.toUpperCase().trim() }),
                        });
                        if (r.ok) { setOtpResendMsg('New code sent — check your email.'); setOtpResendCooldown(30); }
                        else { setOtpVerificationError('Could not resend. Please try again.'); }
                      } catch {
                        setOtpVerificationError('Could not resend. Please try again.');
                      }
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-torqued-red hover:text-red-400 disabled:text-muted/40 disabled:cursor-not-allowed transition-colors"
                  >
                    {otpResendCooldown > 0 ? `Resend code in ${otpResendCooldown}s` : "Didn't get it? Resend code"}
                  </button>
                </div>

                <Button
                  variant="ghost"
                  fullWidth
                  className="text-[10px] text-muted tracking-widest uppercase font-black hover:text-foreground h-10"
                  onClick={() => {
                    setShowOTPModal(false);
                    setOtpCode('');
                    setOtpVerificationError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Integrated Stripe Elements Sheet */}
      <AnimatePresence>
        {showStripeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (stripeFormStep !== 'processing') {
                  setShowStripeModal(false);
                }
              }}
              className="absolute inset-0 bg-background/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-3xl overflow-hidden p-6 md:p-8 space-y-6"
            >
              {/* Stripe Header Brand */}
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase text-foreground bg-foreground/5 py-1 px-2.5 rounded-lg border border-border tracking-wider flex items-center gap-1.5 font-mono">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                    Secure Stripe Sheet
                  </span>
                </div>
                <div className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                  <Lock size={12} className="text-emerald-500" />
                  SSL Certified
                </div>
              </div>

              {stripeFormStep === 'input' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black tracking-tight text-foreground">Secure Stripe Checkout 💳</h3>
                    <p className="text-xs text-muted">
                      Complete your high-value Torqued booking using SSL-secured Stripe checkout.
                    </p>
                  </div>

                  {/* Summary of Booking */}
                  <div className="p-4 bg-muted/40 border border-border rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Target Vehicle:</span>
                      <span className="font-extrabold text-foreground">{vehicle?.year} {vehicle?.make} {vehicle?.model}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Mechanic Workshop:</span>
                      <span className="font-extrabold text-foreground">{selectedMechanic?.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Payment Method:</span>
                      <span className="font-extrabold text-torqued-red uppercase tracking-wider">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border">
                      <span className="text-muted font-bold text-foreground">Amount Charged:</span>
                      <span className="font-black text-sm text-emerald-500 font-mono">
                        ${selectedMechanic?.estimatedPrice || totalPrice}
                        <span className="text-[9px] text-muted ml-1 font-normal font-sans">NZD</span>
                      </span>
                    </div>
                  </div>

                  {isStripeSessionLoading ? (
                    <div className="py-8 text-center space-y-4">
                      <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-muted font-bold font-mono tracking-tight animate-pulse text-emerald-500 bg-emerald-500/10 max-w-xs mx-auto py-2 px-3 rounded-xl border border-emerald-500/15">
                        Establishing secure PCI-compliant Stripe tunnel...
                      </p>
                    </div>
                  ) : (!stripeCheckoutUrl || stripeIsMock) ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-1.5 text-left">
                        <div className="flex items-center gap-2 text-amber-500">
                          <AlertTriangle size={16} />
                          <span className="text-xs font-black uppercase tracking-tight font-mono">Simulated Stripe Gateway</span>
                        </div>
                        <p className="text-[11px] text-muted leading-relaxed font-semibold">
                          No Stripe API keys are configured. Torqued has simulated the secure Stripe hosted environment inside this portal. Credit cards, Afterpay, and Klarna are fully functional in test mode.
                        </p>
                      </div>

                      {/* Required Email & Phone Input */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest block font-mono">
                            Email Address (For Invoicing)
                          </label>
                          <input 
                            type="email" 
                            placeholder="driver@example.co.nz"
                            value={stripeInputEmail}
                            onChange={(e) => setStripeInputEmail(e.target.value)}
                            className="w-full bg-background border border-border h-11 px-3.5 text-sm font-bold rounded-xl focus:outline-none focus:border-torqued-red text-foreground shadow-sm placeholder:text-muted/65"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest block font-mono">
                            Phone / Contact Number (SMS Alerts)
                          </label>
                          <input 
                            type="tel" 
                            placeholder="e.g. +64 21 029 3848"
                            value={stripeInputPhone}
                            onChange={(e) => setStripeInputPhone(e.target.value)}
                            className="w-full bg-background border border-border h-11 px-3.5 text-sm font-bold rounded-xl focus:outline-none focus:border-torqued-red text-foreground shadow-sm placeholder:text-muted/65"
                            required
                          />
                        </div>
                      </div>
                      <p className="text-[9.5px] text-muted text-left">
                        Your invoice, GST receipt, mechanic booking confirmation, and SMS drop alerts will be dispatched to these channels.
                      </p>

                      {/* Credit Card / Pay Later Mock Fields */}
                      <div className="space-y-3.5 pt-1 text-left">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-muted tracking-widest block font-mono">
                            Name on Card / Payment Account
                          </label>
                          <input 
                            type="text" 
                            placeholder="John Doe"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full bg-background border border-border h-11 px-3.5 text-sm font-bold rounded-xl focus:outline-none focus:border-torqued-red"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-muted tracking-widest block font-mono">Card number</label>
                            <input 
                              type="text" 
                              placeholder="4242 4242 4242 4242"
                              value={cardNum}
                              onChange={(e) => setCardNum(e.target.value)}
                              className="w-full bg-background border border-border h-11 px-3.5 text-sm font-mono rounded-xl focus:outline-none focus:border-torqued-red"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-muted tracking-widest block font-mono text-center">Expiry</label>
                              <input 
                                type="text" 
                                placeholder="MM/YY"
                                value={cardExp}
                                onChange={(e) => setCardExp(e.target.value)}
                                className="w-full bg-background border border-border h-11 px-3.5 text-sm font-mono rounded-xl focus:outline-none focus:border-torqued-red text-center"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-muted tracking-widest block font-mono text-center">CVC</label>
                              <input 
                                type="text" 
                                placeholder="CVC"
                                value={cardCvc}
                                onChange={(e) => setCardCvc(e.target.value)}
                                className="w-full bg-background border border-border h-11 px-3.5 text-sm font-mono rounded-xl focus:outline-none focus:border-torqued-red text-center"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {cardError && (
                        <p className="text-xs font-bold text-torqued-red bg-torqued-red/10 border border-torqued-red/15 py-1.5 px-3 rounded-xl text-center">
                          {cardError}
                        </p>
                      )}

                      <div className="p-3 bg-background border border-border rounded-xl text-center">
                        <span className="text-[9.5px] text-muted font-black uppercase tracking-widest block mb-1.5 font-mono">SELECTED TEST PATHWAY</span>
                        <div className="flex justify-center items-center gap-3">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold border ${paymentMethod === 'Credit / Debit' || paymentMethod === 'Credit' || paymentMethod === 'Credit or Debit Card' ? 'bg-foreground/5 text-foreground border-border' : 'bg-muted/10 text-muted border-border/40'}`}>Card (Stripe)</span>
                          <span className={`text-[10px] px-2 py-1 rounded font-bold border ${paymentMethod === 'Afterpay' ? 'bg-pink-500/10 text-pink-400 border-pink-500/15' : 'bg-muted/10 text-muted border-border/40'}`}>Afterpay</span>
                          <span className={`text-[10px] px-2 py-1 rounded font-bold border ${paymentMethod === 'Klarna' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15' : 'bg-muted/10 text-muted border-border/40'}`}>Klarna</span>
                        </div>
                      </div>

                      <Button
                        onClick={handleMockPaymentSuccess}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest h-14 rounded-2xl transition-all shadow-xl shadow-emerald-600/10 cursor-pointer"
                      >
                        Simulate Payment Success & Confirm Booking
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-1.5 text-left">
                        <div className="flex items-center gap-2 text-emerald-500 animate-pulse">
                          <CheckCircle2 size={16} />
                          <span className="text-xs font-black uppercase tracking-tight">SECURE LIVE MODE ACTIVE</span>
                        </div>
                        <p className="text-[11px] text-muted leading-relaxed font-semibold font-mono">
                          Your Stripe merchant gateway is fully integrated. Live payment methods (Credit cards, Afterpay, Klarna) are dynamically enabled based on your merchant configuration.
                        </p>
                      </div>

                      <a 
                        href={stripeCheckoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest h-14 rounded-2xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                        onClick={() => {
                          setStripeFormStep('processing');
                          setStripeLoadingMessage('Awaiting secure Stripe payment completion status callback...');
                        }}
                      >
                        Proceed to Secure Checkout 🡥
                      </a>

                      <div className="p-3 bg-background border border-border rounded-xl text-center">
                        <span className="text-[9.5px] text-muted font-black uppercase tracking-widest block mb-1.5 font-mono font-mono">AVAILABLE PAYMENT OPTIONS</span>
                        <div className="flex justify-center items-center gap-3">
                          <span className="text-[10px] bg-foreground/5 text-foreground px-2 py-1 rounded font-bold border border-border">Visa / Mastercard</span>
                          <span className="text-[10px] bg-pink-500/10 text-pink-400 px-2 py-1 rounded font-bold border border-pink-500/15 font-sans">Afterpay</span>
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded font-bold border border-cyan-500/15">Klarna</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => setShowStripeModal(false)}
                      className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-foreground border border-border/60 h-12 rounded-xl"
                    >
                      Bail Out / Close
                    </Button>
                  </div>
                </div>
              )}

              {stripeFormStep === 'processing' && (
                <div className="py-12 space-y-6 text-center">
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-emerald-500 rounded-full animate-spin" />
                    <CreditCard size={32} className="text-emerald-500 animate-pulse" />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-lg font-black tracking-tighter text-foreground">Processing Secure Payment...</h4>
                    <p className="text-xs text-muted font-bold font-mono text-center tracking-tight animate-pulse text-emerald-500 bg-emerald-500/10 max-w-sm mx-auto py-2 p-3 rounded-xl border border-emerald-500/15">
                      {stripeLoadingMessage}
                    </p>
                    
                    <div className="pt-2 max-w-xs mx-auto">
                      <Button
                        onClick={async () => {
                          const pending = localStorage.getItem('pending_booking');
                          if (pending) {
                            try {
                              const booking = JSON.parse(pending);
                              booking.paymentStatus = 'confirmed';
                              booking.status = 'booked';
                              setActiveJobs(prev => [...prev, booking]);
                              setLatestBooking(booking);
                              await triggerEmailConfirmation(booking);
                            } catch (err) {
                              console.error(err);
                            }
                          }
                          setStripeFormStep('success');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] h-10 tracking-widest rounded-xl transition-all shadow"
                      >
                        Simulate Payment Webhook Success
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {stripeFormStep === 'success' && (
                <div className="py-10 space-y-6 text-center">
                  <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                    <CheckCircle2 size={44} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black tracking-tight text-foreground">Booking Confirmed! 🏁</h4>
                    <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                      Stripe successfully charged and secured your payment. Your live vehicle history has been updated and sent to {selectedMechanic?.name}.
                    </p>
                  </div>
                  <Button
                    fullWidth
                    onClick={() => {
                      setShowStripeModal(false);
                      setStep(7); // Show confirmation portal step
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest h-12 rounded-xl"
                  >
                    View Active Mechanic Progress
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer AI assistant chat modal */}
      <AnimatePresence>
        {chatOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-md" onClick={() => setChatOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[85vh] sm:h-[640px] bg-card border border-border sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-torqued-red/15 flex items-center justify-center"><Sparkles size={18} className="text-torqued-red" /></div>
                <div className="flex-1"><h3 className="font-bold leading-none">Torqued Assistant</h3><p className="text-[11px] text-muted mt-0.5">{vehicle ? `Helping with your ${vehicle.make} ${vehicle.model}` : 'Diagnostic & maintenance help'}</p></div>
                <button onClick={() => setChatOpen(false)} className="p-2 hover:bg-background rounded-lg"><X size={18} className="text-muted" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="space-y-3">
                    <Card className="p-4 bg-background border-border"><p className="text-sm text-muted">Tell me what's worrying you about your car, or ask a maintenance question. I can see your vehicles and service history to tailor the answer — then help you book.</p></Card>
                    {chatStarters.map(s => (
                      <button key={s} onClick={() => sendChat(s)} className="w-full text-left text-sm p-3 rounded-xl border border-border bg-background hover:border-torqued-red/30 transition-all flex items-center justify-between gap-2">
                        <span>{s}</span><ChevronRight size={16} className="text-torqued-red shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                    {m.image && (
                      <img src={m.image} alt="attached" className="max-h-36 rounded-xl object-cover mb-1 border border-border" />
                    )}
                    <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-torqued-red text-white' : 'bg-background border border-border text-foreground')}>
                      {m.text}
                      {m.role === 'assistant' && i === chatMessages.length - 1 && !chatBusy && (
                        <button onClick={() => { setChatOpen(false); setView('quote'); setStep(2); }} className="mt-3 inline-flex items-center gap-1.5 bg-torqued-red text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                          <Wrench size={13} /> Book a service
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatBusy && <div className="flex justify-start"><div className="bg-background border border-border rounded-2xl px-4 py-3 text-sm text-muted">Thinking…</div></div>}
              </div>

              <div className="p-3 border-t border-border space-y-2">
                {chatPhoto && (
                  <div className="relative w-fit">
                    <img src={chatPhoto} alt="pending" className="h-16 rounded-xl object-cover border border-torqued-red/40" />
                    <button onClick={() => setChatPhoto(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-torqued-red rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <label className="cursor-pointer flex items-center justify-center w-10 h-10 bg-background border border-border rounded-xl text-muted hover:border-torqued-red hover:text-torqued-red transition-all shrink-0">
                    <Camera size={17} />
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const reader = new FileReader();
                      reader.onload = ev => setChatPhoto(ev.target?.result as string);
                      reader.readAsDataURL(f);
                      e.target.value = '';
                    }} />
                  </label>
                  <textarea
                    value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                    rows={1} placeholder="Ask about your car or attach a photo…"
                    className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-torqued-red text-foreground max-h-28" />
                  <button onClick={() => sendChat(chatInput)} disabled={chatBusy || (!chatInput.trim() && !chatPhoto)} className="w-10 h-10 rounded-xl bg-torqued-red text-white flex items-center justify-center disabled:opacity-40 shrink-0">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Email Confirmation Layout Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-background border border-border w-full max-w-4xl h-[88vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-6 border-b border-border bg-card">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-torqued-red tracking-widest leading-none">Otago Service Relay Operations</span>
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Interactive Email & SMS Terminal</h3>
                    <p className="text-xs text-muted">Verify secure consumer dispatches and active Otago mechanic alerts.</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEmailModal(false);
                      setTestSendStatus('idle');
                    }}
                    className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-background text-foreground transition-colors font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Tab Selector */}
                <div className="flex flex-wrap items-center gap-1.5 mt-5 border-t border-border/50 pt-4">
                  {[
                    { id: 'customer', label: '1. Client Confirmation', icon: <Mail size={12} /> },
                    { id: 'mechanic', label: '2. Workshop Dispatch', icon: <Wrench size={12} /> },
                    { id: 'dropoff', label: '3. 12h Dropoff Alert', icon: <Clock size={12} /> },
                    { id: 'service', label: '4. Service Reminder', icon: <Info size={12} /> },
                    { id: 'sms', label: '5. SMS Secure Notice', icon: <Smartphone size={12} /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setSelectedEmailTab(tab.id as any);
                        setTestSendStatus('idle');
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all",
                        selectedEmailTab === tab.id
                          ? "bg-torqued-red text-white shadow-md shadow-torqued-red/10"
                          : "bg-background text-muted hover:text-foreground hover:bg-muted border border-border/80"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Content Canvas */}
              <div className="flex-1 bg-zinc-100 p-2 overflow-hidden relative dark:bg-zinc-950">
                {selectedEmailTab === 'sms' ? (
                  <div className="flex items-center justify-center h-full bg-zinc-200 p-4 dark:bg-zinc-900 rounded-2xl overflow-y-auto">
                    <div className="w-full max-w-xs bg-black rounded-[40px] p-4 pt-10 pb-10 shadow-2xl border-[6px] border-zinc-800 relative my-auto">
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full flex justify-center items-center">
                        <div className="w-10 h-1 bg-zinc-800 rounded-full" />
                      </div>
                      <div className="bg-zinc-950 rounded-[28px] p-4 text-white min-h-[220px] flex flex-col justify-between font-sans">
                        <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-torqued-red flex items-center justify-center font-bold text-xs text-white">TQ</div>
                          <div>
                            <p className="text-xs font-bold text-zinc-100">Torqued NZ</p>
                            <p className="text-[9px] text-zinc-500">Secure Direct Notify</p>
                          </div>
                        </div>
                        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-3.5 text-xs text-zinc-200 leading-relaxed font-semibold self-end shadow-md max-w-[90%] relative">
                          {emittedSmsText || `TORQUED: Booking Ref #${latestBooking?.id || 'TQ-TEST-998A'} is confirmed for vehicle (${vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Volkswagen Golf GTE'} - ${vehicle?.rego || 'RAH190'}). Drop off date is ${latestBooking?.date || selectedDate} @ ${selectedTime}.`}
                        </div>
                        <div className="text-[8px] text-zinc-600 text-center font-mono mt-4">Authorized Otago Dispatch Hub</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    let activeHtml = '';
                    if (selectedEmailTab === 'customer') activeHtml = emittedEmailHtml || '';
                    else if (selectedEmailTab === 'mechanic') activeHtml = emittedMechanicHtml || '';
                    else if (selectedEmailTab === 'dropoff') activeHtml = emittedDropoffHtml || '';
                    else if (selectedEmailTab === 'service') activeHtml = emittedServiceReminderHtml || '';

                    return (
                      <iframe
                        title="Email Template Sandbox Preview"
                        srcDoc={activeHtml || `
                          <html>
                            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #150402; color: white; margin: 0; padding: 20px; box-sizing: border-box; text-align: center;">
                              <div>
                                <p style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #FF1800; letter-spacing: 0.5px;">⌛ GENERATING DYNAMIC DATA STYLES</p>
                                <p style="font-size: 11px; color: rgba(255,255,255,0.6); max-width: 320px; line-height: 1.5; margin: 0 auto;">Establishing secure connection to mail delivery network. Please confirm booking details if preview results do not update automatically.</p>
                              </div>
                            </body>
                          </html>
                        `}
                        className="w-full h-full border-0 rounded-2xl bg-white"
                        referrerPolicy="no-referrer"
                      />
                    );
                  })()
                )}
              </div>

              {/* SMTP Sandbox Send test console */}
              <div className="p-4 bg-card border-t border-border flex flex-col md:flex-row items-center gap-3.5 justify-between">
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                  <div className="p-2 bg-torqued-red/10 text-torqued-red rounded-xl">
                    <Mail size={16} />
                  </div>
                  <div className="space-y-0.5 text-left">
                    <span className="text-[10px] font-black uppercase text-muted tracking-wide leading-none">SMTP Relay Test</span>
                    <h4 className="text-xs font-extrabold text-foreground leading-none">DELIVER DRAFT COPIES TO INBOX</h4>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto flex-1 max-w-lg">
                  <input
                    type="email"
                    placeholder="Recipient e.g. sri.140nz@gmail.com"
                    value={testEmailAddress || ''}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="flex-1 bg-background text-sm px-3 py-2 rounded-xl border border-border focus:outline-none focus:border-torqued-red text-foreground font-semibold placeholder:text-muted/40 h-10"
                  />
                  <Button
                    onClick={handleSendTestSingle}
                    disabled={isSendingTest || selectedEmailTab === 'sms'}
                    className="bg-torqued-red hover:bg-torqued-red/90 text-white font-black text-xs uppercase px-5 rounded-xl shrink-0 h-10 flex gap-2 items-center shadow-lg shadow-torqued-red/10"
                  >
                    {isSendingTest ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Relaying...
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        Dispatch live test
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Notifications */}
              {testSendStatus !== 'idle' && (
                <div className={cn(
                  "px-6 py-2.5 border-t text-xs font-bold font-mono tracking-tight text-center sm:text-left",
                  testSendStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                )}>
                  {testSendStatus === 'success' ? '✓ ' : '✗ '} {testSendStatusMsg}
                </div>
              )}

              {/* Close Footer controls */}
              <div className="p-5 border-t border-border bg-card flex justify-between items-center bg-card/50">
                <p className="text-[9px] text-muted font-black uppercase tracking-wider">
                  SPEC: RACING COAL (#150402) & SOLID SCARLET (#FF1800)
                </p>
                <Button
                  onClick={() => {
                    setShowEmailModal(false);
                    setTestSendStatus('idle');
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border border-border text-foreground font-black text-xs uppercase px-6 h-11 rounded-xl shadow-md"
                >
                  Close Terminal
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {view === 'quote' && step < 5 && (
        <div className="p-4 border-t border-border bg-background md:hidden">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map(s => (
                <div key={s} className={cn("h-1 w-6 rounded-full", s <= step ? "bg-torqued-red" : "bg-border")} />
              ))}
            </div>
            <span className="text-[10px] font-bold uppercase text-muted">Step {step} of 6</span>
          </div>
        </div>
      )}
    </div>
  );
};

