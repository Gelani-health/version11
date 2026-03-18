"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  AlertCircle,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Upload,
  Trash2,
  Globe,
  Users,
  CreditCard,
  Shield,
  Languages,
  Building,
  Home,
  Calendar,
  FileUp,
  Paperclip,
  StickyNote,
  Contact,
  Check,
  AlertTriangle,
  Baby,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  countries,
  countriesWithCities,
  languages,
  nationalities,
  religions,
  bloodTypes,
  maritalStatuses,
  genders,
  relationshipOptions,
  phoneTypes,
  titleOptions,
  identificationDocumentTypes,
  getAddressFormat,
  type AddressFieldConfig,
  drugAllergies,
  otherAllergies,
  transmissibleConditions,
  chronicConditionsList,
  pregnancyStatusOptions,
  trimesterOptions,
  insuranceProviders,
} from "@/lib/data/world-data";

// ============================================
// TYPES
// ============================================

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface AddressData {
  country: string;
  city: string;
  streetAddress: string;
  // Dynamic fields
  [key: string]: string;
}

interface PatientFormData {
  // Personal Information
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  
  // Nationality & Language
  nationalities: string[];
  languages: string[];
  religion: string;
  
  // Identification
  idType: string; // Type of identification document (passport, national_id, residence_permit, etc.)
  idNumber: string; // The identification document number
  
  // Contact Information
  phone: string;
  phoneType: string;
  alternatePhone: string;
  email: string;
  
  // Address
  address: AddressData;
  
  // Emergency Contacts
  emergencyContacts: EmergencyContact[];
  
  // Medical Information
  bloodType: string;
  rhFactor: string;
  drugAllergies: string[];
  drugAllergiesOther: string;
  otherAllergies: string[];
  otherAllergiesNotes: string;
  chronicConditions: string[];
  organDonor: string;
  pregnancyStatus: string;
  pregnancyTrimester: string;
  pregnancyDueDate: string;
  transmissibleConditions: string[];
  transmissibleConditionsOther: string;
  
  // Notes & Attachments
  notes: string;
  attachments: File[];
  
  // Insurance
  hasInsurance: boolean;
  insuranceProvider: string;
  insuranceId: string;
  insuranceGroup: string;
}

interface PatientRegistrationCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PatientFormData) => Promise<void>;
  initialData?: Partial<PatientFormData>;
  mode?: "create" | "edit";
}

// ============================================
// MULTI-SELECT COMPONENT
// ============================================

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
}

function MultiSelect({ options, selected, onChange, placeholder = "Select options", label }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleRemove = (option: string) => {
    onChange(selected.filter((s) => s !== option));
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-[40px] h-auto"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selected.length > 0 ? (
                selected.map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className="mr-1 mb-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item);
                    }}
                  >
                    {item}
                    <X className="ml-1 h-3 w-3 cursor-pointer" />
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label?.toLowerCase() || "options"}...`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    onSelect={() => handleSelect(option)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selected.includes(option)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50"
                      )}
                    >
                      {selected.includes(option) && <Check className="h-3 w-3" />}
                    </div>
                    <span>{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============================================
// EMERGENCY CONTACT COMPONENT
// ============================================

interface EmergencyContactCardProps {
  contact: EmergencyContact;
  index: number;
  onChange: (contact: EmergencyContact) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function EmergencyContactCard({ contact, index, onChange, onRemove, canRemove }: EmergencyContactCardProps) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Contact className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-medium">
              Emergency Contact {index + 1}
            </CardTitle>
            {contact.name && (
              <Badge variant="outline" className="text-xs">
                {contact.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 w-7 p-0"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Full Name *</Label>
                  <Input
                    value={contact.name}
                    onChange={(e) => onChange({ ...contact, name: e.target.value })}
                    placeholder="Contact name"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Relationship *</Label>
                  <Select
                    value={contact.relationship}
                    onValueChange={(value) => onChange({ ...contact, relationship: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipOptions.map((rel) => (
                        <SelectItem key={rel} value={rel}>
                          {rel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Phone Number *</Label>
                  <Input
                    value={contact.phone}
                    onChange={(e) => onChange({ ...contact, phone: e.target.value })}
                    placeholder="Phone number"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => onChange({ ...contact, email: e.target.value })}
                    placeholder="Email address"
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ============================================
// DYNAMIC ADDRESS FORM
// ============================================

interface DynamicAddressFormProps {
  country: string;
  address: AddressData;
  onChange: (address: AddressData) => void;
}

function DynamicAddressForm({ country, address, onChange }: DynamicAddressFormProps) {
  const addressFormat = getAddressFormat(country);
  
  const cities = useMemo(() => {
    if (country && countriesWithCities[country]) {
      return countriesWithCities[country];
    }
    return [];
  }, [country]);

  const handleFieldChange = (fieldName: string, value: string) => {
    onChange({ ...address, [fieldName]: value });
  };

  const renderField = (field: AddressFieldConfig) => {
    const value = address[field.name] || "";
    
    if (field.type === "select" && field.options) {
      return (
        <Select
          value={value}
          onValueChange={(v) => handleFieldChange(field.name, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        value={value}
        onChange={(e) => handleFieldChange(field.name, e.target.value)}
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Country Selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Country *
        </Label>
        <Select
          value={country}
          onValueChange={(value) => {
            onChange({
              country: value,
              city: "",
              streetAddress: "",
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dynamic Fields Based on Country */}
      {country && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            {addressFormat.fields.map((field) => (
              <div
                key={field.name}
                className={cn(
                  "space-y-2",
                  field.name === "region" || field.name === "state" || field.name === "province" ? "col-span-2" : ""
                )}
              >
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </div>

          {/* City Selector */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                City *
              </Label>
              {cities.length > 0 ? (
                <Select
                  value={address.city || ""}
                  onValueChange={(value) => handleFieldChange("city", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={address.city || ""}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  placeholder="Enter city"
                />
              )}
            </div>
          </div>

          {/* Street Address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Street Address
            </Label>
            <Textarea
              value={address.streetAddress || ""}
              onChange={(e) => handleFieldChange("streetAddress", e.target.value)}
              placeholder="Street address, building, apartment..."
              rows={2}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============================================
// FILE UPLOAD COMPONENT
// ============================================

interface FileUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
}

function FileUpload({ files, onChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      onChange([...files, ...newFiles]);
    }
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-600">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-slate-400 mt-1">
          PDF, DOC, DOCX, Images up to 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-slate-50 rounded-md"
            >
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-500" />
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                <span className="text-xs text-slate-400">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                className="h-7 w-7 p-0 text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PATIENT REGISTRATION CARD
// ============================================

export function PatientRegistrationCard({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "create",
}: PatientRegistrationCardProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  
  const [formData, setFormData] = useState<PatientFormData>({
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationalities: [],
    languages: [],
    religion: "",
    idType: "national_id", // Default to National ID Card
    idNumber: "",
    phone: "",
    phoneType: "Mobile",
    alternatePhone: "",
    email: "",
    address: {
      country: "",
      city: "",
      streetAddress: "",
    },
    emergencyContacts: [
      {
        id: "1",
        name: "",
        relationship: "",
        phone: "",
        email: "",
      },
    ],
    bloodType: "",
    rhFactor: "",
    drugAllergies: [],
    drugAllergiesOther: "",
    otherAllergies: [],
    otherAllergiesNotes: "",
    chronicConditions: [],
    organDonor: "Not Specified",
    pregnancyStatus: "Not Applicable",
    pregnancyTrimester: "",
    pregnancyDueDate: "",
    transmissibleConditions: [],
    transmissibleConditionsOther: "",
    notes: "",
    attachments: [],
    hasInsurance: false,
    insuranceProvider: "",
    insuranceId: "",
    insuranceGroup: "",
    ...initialData,
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        emergencyContacts: initialData.emergencyContacts?.length
          ? initialData.emergencyContacts
          : prev.emergencyContacts,
      }));
    }
  }, [initialData]);

  const handleAddEmergencyContact = () => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: [
        ...prev.emergencyContacts,
        {
          id: Date.now().toString(),
          name: "",
          relationship: "",
          phone: "",
          email: "",
        },
      ],
    }));
  };

  const handleRemoveEmergencyContact = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((c) => c.id !== id),
    }));
  };

  const handleUpdateEmergencyContact = (id: string, contact: EmergencyContact) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((c) =>
        c.id === id ? contact : c
      ),
    }));
  };

  const handleSubmit = async () => {
    // Validation
    const required = [
      { field: formData.firstName, label: "First Name" },
      { field: formData.lastName, label: "Last Name" },
      { field: formData.dateOfBirth, label: "Date of Birth" },
      { field: formData.gender, label: "Gender" },
      { field: formData.phone, label: "Phone Number" },
    ];

    const missing = required.filter((r) => !r.field);
    if (missing.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in: ${missing.map((m) => m.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Validate emergency contacts
    const validContacts = formData.emergencyContacts.filter(
      (c) => c.name && c.relationship && c.phone
    );
    if (validContacts.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one emergency contact with name, relationship, and phone",
        variant: "destructive",
      });
      setActiveTab("emergency");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        ...formData,
        emergencyContacts: validContacts,
      });
      toast({
        title: "Success",
        description: `Patient ${mode === "create" ? "registered" : "updated"} successfully`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${mode} patient`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {mode === "create" ? "Register New Patient" : "Edit Patient Information"}
              </DialogTitle>
              <DialogDescription>
                Complete all required fields to {mode === "create" ? "register" : "update"} patient
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 mb-6">
                <TabsTrigger value="personal" className="text-xs">
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  Personal
                </TabsTrigger>
                <TabsTrigger value="contact" className="text-xs">
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Contact
                </TabsTrigger>
                <TabsTrigger value="emergency" className="text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Emergency
                </TabsTrigger>
                <TabsTrigger value="medical" className="text-xs">
                  <Heart className="h-3.5 w-3.5 mr-1.5" />
                  Medical
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Notes
                </TabsTrigger>
              </TabsList>

              {/* Personal Information Tab */}
              <TabsContent value="personal" className="space-y-6 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Title & Name */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Select
                          value={formData.title}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, title: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {titleOptions.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>First Name *</Label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, firstName: e.target.value }))
                          }
                          placeholder="First name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Middle Name</Label>
                        <Input
                          value={formData.middleName}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, middleName: e.target.value }))
                          }
                          placeholder="Middle name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name *</Label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, lastName: e.target.value }))
                          }
                          placeholder="Last name"
                        />
                      </div>
                    </div>

                    {/* DOB, Gender, Marital Status */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span className="truncate">Date of Birth *</span>
                        </Label>
                        <Input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, dateOfBirth: e.target.value }))
                          }
                          className="min-w-0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Gender *</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, gender: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            {genders.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Marital Status</Label>
                        <Select
                          value={formData.maritalStatus}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, maritalStatus: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {maritalStatuses.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Nationality & Language */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Nationality & Language
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <MultiSelect
                        options={nationalities}
                        selected={formData.nationalities}
                        onChange={(selected) =>
                          setFormData((p) => ({ ...p, nationalities: selected }))
                        }
                        placeholder="Select nationalities"
                        label="Nationalities"
                      />
                      <MultiSelect
                        options={languages}
                        selected={formData.languages}
                        onChange={(selected) =>
                          setFormData((p) => ({ ...p, languages: selected }))
                        }
                        placeholder="Select languages"
                        label="Languages Spoken"
                      />
                    </div>

                    {/* Religion - Optional */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Religion <span className="text-xs text-muted-foreground">(Optional)</span>
                      </Label>
                      <Select
                        value={formData.religion}
                        onValueChange={(value) =>
                          setFormData((p) => ({ ...p, religion: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select religion (optional)" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {religions.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Identification */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Identification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Identification Document */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 shrink-0" />
                            ID Document Type *
                          </Label>
                          <Select
                            value={formData.idType}
                            onValueChange={(value) =>
                              setFormData((p) => ({ ...p, idType: value }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select ID type">
                                {formData.idType && identificationDocumentTypes.find(t => t.value === formData.idType)?.label}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {identificationDocumentTypes.map((idType) => (
                                <SelectItem key={idType.value} value={idType.value}>
                                  <div className="flex flex-col items-start py-0.5">
                                    <span className="font-medium">{idType.label}</span>
                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                      {idType.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>ID Number *</Label>
                          <Input
                            value={formData.idNumber}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, idNumber: e.target.value }))
                            }
                            placeholder={
                              identificationDocumentTypes.find(t => t.value === formData.idType)?.label 
                                ? `Enter ${identificationDocumentTypes.find(t => t.value === formData.idType)?.label.toLowerCase()} number`
                                : "Enter ID number"
                            }
                            className="w-full"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the type of identification document you are providing and enter the document number.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Contact Information Tab */}
              <TabsContent value="contact" className="space-y-6 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Primary Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span className="truncate">Primary Phone Number *</span>
                        </Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, phone: e.target.value }))
                          }
                          placeholder="Enter phone number"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Type</Label>
                        <Select
                          value={formData.phoneType}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, phoneType: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {phoneTypes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Alternate Phone */}
                    <div className="space-y-2">
                      <Label>Alternate Phone Number</Label>
                      <Input
                        value={formData.alternatePhone}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, alternatePhone: e.target.value }))
                        }
                        placeholder="Enter alternate phone number (optional)"
                        className="w-full"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        Email Address
                      </Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, email: e.target.value }))
                        }
                        placeholder="email@example.com"
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Dynamic Address */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address Information
                    </CardTitle>
                    <CardDescription>
                      Address fields will adapt based on selected country
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DynamicAddressForm
                      country={formData.address.country}
                      address={formData.address}
                      onChange={(address) =>
                        setFormData((p) => ({ ...p, address }))
                      }
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Emergency Contacts Tab */}
              <TabsContent value="emergency" className="space-y-6 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          Emergency Contacts
                        </CardTitle>
                        <CardDescription>
                          Add at least one emergency contact with name, relationship, and phone
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddEmergencyContact}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Contact
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {formData.emergencyContacts.map((contact, index) => (
                        <EmergencyContactCard
                          key={contact.id}
                          contact={contact}
                          index={index}
                          onChange={(c) => handleUpdateEmergencyContact(contact.id, c)}
                          onRemove={() => handleRemoveEmergencyContact(contact.id)}
                          canRemove={formData.emergencyContacts.length > 1}
                        />
                      ))}
                    </div>

                    {formData.emergencyContacts.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Contact className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No emergency contacts added</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={handleAddEmergencyContact}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Emergency Contact
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Medical Information Tab */}
              <TabsContent value="medical" className="space-y-6 mt-0">
                {/* Basic Medical Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Basic Medical Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Blood Type</Label>
                        <Select
                          value={formData.bloodType}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, bloodType: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {bloodTypes.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Rh Factor</Label>
                        <Select
                          value={formData.rhFactor}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, rhFactor: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="positive">Positive (+)</SelectItem>
                            <SelectItem value="negative">Negative (-)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Organ Donor</Label>
                        <Select
                          value={formData.organDonor}
                          onValueChange={(value) =>
                            setFormData((p) => ({ ...p, organDonor: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                            <SelectItem value="Not Specified">Not Specified</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Drug Allergies */}
                <Card className="border-red-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Drug Allergies
                    </CardTitle>
                    <CardDescription>
                      Select all known drug allergies. This information is critical for patient safety.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MultiSelect
                      options={drugAllergies}
                      selected={formData.drugAllergies}
                      onChange={(selected) =>
                        setFormData((p) => ({ ...p, drugAllergies: selected }))
                      }
                      placeholder="Select drug allergies..."
                      label="Known Drug Allergies"
                    />
                    <div className="space-y-2">
                      <Label>Other Drug Allergies (specify)</Label>
                      <Textarea
                        value={formData.drugAllergiesOther}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, drugAllergiesOther: e.target.value }))
                        }
                        placeholder="Enter any other drug allergies not listed above, separated by commas"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Other Allergies */}
                <Card className="border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="h-4 w-4" />
                      Other Allergies
                    </CardTitle>
                    <CardDescription>
                      Food, environmental, and other non-drug allergies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MultiSelect
                      options={otherAllergies}
                      selected={formData.otherAllergies}
                      onChange={(selected) =>
                        setFormData((p) => ({ ...p, otherAllergies: selected }))
                      }
                      placeholder="Select other allergies..."
                      label="Food & Environmental Allergies"
                    />
                    <div className="space-y-2">
                      <Label>Additional Allergy Notes</Label>
                      <Textarea
                        value={formData.otherAllergiesNotes}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, otherAllergiesNotes: e.target.value }))
                        }
                        placeholder="Describe any additional allergies or reactions"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Pregnancy Information - Only show for female patients */}
                {(formData.gender === "Female" || formData.gender === "female") && (
                  <Card className="border-pink-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-pink-700">
                        <Baby className="h-4 w-4" />
                        Pregnancy Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pregnancy Status</Label>
                          <Select
                            value={formData.pregnancyStatus}
                            onValueChange={(value) =>
                              setFormData((p) => ({ ...p, pregnancyStatus: value }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {pregnancyStatusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {formData.pregnancyStatus === "Currently Pregnant" && (
                          <>
                            <div className="space-y-2">
                              <Label>Trimester</Label>
                              <Select
                                value={formData.pregnancyTrimester}
                                onValueChange={(value) =>
                                  setFormData((p) => ({ ...p, pregnancyTrimester: value }))
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select trimester" />
                                </SelectTrigger>
                                <SelectContent>
                                  {trimesterOptions.map((trimester) => (
                                    <SelectItem key={trimester} value={trimester}>
                                      {trimester}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Expected Due Date</Label>
                              <Input
                                type="date"
                                value={formData.pregnancyDueDate}
                                onChange={(e) =>
                                  setFormData((p) => ({ ...p, pregnancyDueDate: e.target.value }))
                                }
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Transmissible Conditions */}
                <Card className="border-yellow-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
                      <Activity className="h-4 w-4" />
                      Critical Transmissible Conditions
                    </CardTitle>
                    <CardDescription>
                      Important for infection control and patient safety protocols
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MultiSelect
                      options={transmissibleConditions}
                      selected={formData.transmissibleConditions}
                      onChange={(selected) =>
                        setFormData((p) => ({ ...p, transmissibleConditions: selected }))
                      }
                      placeholder="Select conditions..."
                      label="Known Transmissible Conditions"
                    />
                    <div className="space-y-2">
                      <Label>Other Transmissible Conditions (specify)</Label>
                      <Textarea
                        value={formData.transmissibleConditionsOther}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, transmissibleConditionsOther: e.target.value }))
                        }
                        placeholder="Enter any other transmissible conditions not listed above"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Chronic Conditions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Chronic Conditions
                    </CardTitle>
                    <CardDescription>
                      Ongoing medical conditions requiring regular care or monitoring
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MultiSelect
                      options={chronicConditionsList}
                      selected={formData.chronicConditions}
                      onChange={(selected) =>
                        setFormData((p) => ({ ...p, chronicConditions: selected }))
                      }
                      placeholder="Select chronic conditions..."
                      label="Known Chronic Conditions"
                    />
                  </CardContent>
                </Card>

                {/* Insurance Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Insurance Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Insurance checkbox */}
                    <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
                      <Checkbox
                        id="hasInsurance"
                        checked={formData.hasInsurance}
                        onCheckedChange={(checked) =>
                          setFormData((p) => ({ ...p, hasInsurance: checked as boolean }))
                        }
                      />
                      <Label htmlFor="hasInsurance" className="cursor-pointer font-medium">
                        Patient has health insurance
                      </Label>
                    </div>

                    {/* Insurance details - only show if hasInsurance is true */}
                    {formData.hasInsurance && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Insurance Provider</Label>
                            <Select
                              value={formData.insuranceProvider}
                              onValueChange={(value) =>
                                setFormData((p) => ({ ...p, insuranceProvider: value }))
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {insuranceProviders.map((provider) => (
                                  <SelectItem key={provider} value={provider}>
                                    {provider}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Policy/Member ID</Label>
                            <Input
                              value={formData.insuranceId}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, insuranceId: e.target.value }))
                              }
                              placeholder="Enter member ID"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Group Number (if applicable)</Label>
                          <Input
                            value={formData.insuranceGroup}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, insuranceGroup: e.target.value }))
                            }
                            placeholder="Enter group number"
                          />
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notes & Attachments Tab */}
              <TabsContent value="notes" className="space-y-6 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Notes
                    </CardTitle>
                    <CardDescription>
                      Add any additional notes about the patient
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, notes: e.target.value }))
                      }
                      placeholder="Enter any notes about the patient, medical history from other hospitals, special requirements, etc."
                      rows={5}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileUp className="h-4 w-4" />
                      Attachments
                    </CardTitle>
                    <CardDescription>
                      Upload medical reports or documents from other hospitals
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileUpload
                      files={formData.attachments}
                      onChange={(files) =>
                        setFormData((p) => ({ ...p, attachments: files }))
                      }
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t bg-slate-50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {mode === "create" ? "Registering..." : "Saving..."}
              </>
            ) : mode === "create" ? (
              "Register Patient"
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PatientRegistrationCard;
