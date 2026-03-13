import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Eye } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';

// Contract templates
const ARTIST_CONTRACTS = [
  {
    id: 'event-agreement',
    title: 'Event Agreement',
    description: 'Confirm event date, time, location, rate, and terms',
    fields: [
      { name: 'artistName', label: 'Artist Name', type: 'text', required: true },
      { name: 'clientName', label: 'Client Name', type: 'text', required: true },
      { name: 'eventDate', label: 'Event Date', type: 'date', required: true },
      { name: 'eventTime', label: 'Event Time', type: 'time', required: true },
      { name: 'eventLocation', label: 'Event Location', type: 'text', required: true },
      { name: 'eventType', label: 'Event Type', type: 'text', required: true },
      { name: 'rate', label: 'Rate ($)', type: 'number', required: true },
      { name: 'duration', label: 'Duration (hours)', type: 'number', required: true },
      { name: 'deposit', label: 'Deposit Required ($)', type: 'number', required: false },
      { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false },
    ]
  },
  {
    id: 'liability-waiver',
    title: 'Liability Waiver',
    description: 'Protect yourself from accidents and incidents',
    fields: [
      { name: 'artistName', label: 'Artist Name', type: 'text', required: true },
      { name: 'clientName', label: 'Client Name', type: 'text', required: true },
      { name: 'eventDate', label: 'Event Date', type: 'date', required: true },
      { name: 'eventLocation', label: 'Event Location', type: 'text', required: true },
      { name: 'clientSignature', label: 'Client Signature (Type Name)', type: 'text', required: true },
    ]
  },
  {
    id: 'technical-rider',
    title: 'Technical Rider',
    description: 'Specify equipment, power, and setup requirements',
    fields: [
      { name: 'artistName', label: 'Artist Name', type: 'text', required: true },
      { name: 'equipment', label: 'Equipment Needed', type: 'textarea', required: true },
      { name: 'powerRequirements', label: 'Power Requirements', type: 'text', required: true },
      { name: 'internetRequired', label: 'Internet Required', type: 'text', required: false },
      { name: 'setupTime', label: 'Setup Time (minutes)', type: 'number', required: true },
      { name: 'soundCheck', label: 'Sound Check Required', type: 'text', required: false },
      { name: 'additionalNotes', label: 'Additional Notes', type: 'textarea', required: false },
    ]
  }
];

const CLIENT_CONTRACTS = [
  {
    id: 'event-agreement-client',
    title: 'Event Agreement (Client)',
    description: 'Confirm event details and booking terms',
    fields: [
      { name: 'clientName', label: 'Your Name', type: 'text', required: true },
      { name: 'artistName', label: 'Artist/Performer Name', type: 'text', required: true },
      { name: 'eventDate', label: 'Event Date', type: 'date', required: true },
      { name: 'eventTime', label: 'Event Time', type: 'time', required: true },
      { name: 'eventLocation', label: 'Event Location', type: 'text', required: true },
      { name: 'eventType', label: 'Event Type', type: 'text', required: true },
      { name: 'guestCount', label: 'Expected Guest Count', type: 'number', required: false },
      { name: 'budget', label: 'Budget ($)', type: 'number', required: true },
      { name: 'specialRequests', label: 'Special Requests', type: 'textarea', required: false },
    ]
  },
  {
    id: 'liability-release',
    title: 'Liability Release',
    description: 'Release performer from liability for accidents',
    fields: [
      { name: 'clientName', label: 'Your Name', type: 'text', required: true },
      { name: 'artistName', label: 'Artist/Performer Name', type: 'text', required: true },
      { name: 'eventDate', label: 'Event Date', type: 'date', required: true },
      { name: 'eventLocation', label: 'Event Location', type: 'text', required: true },
      { name: 'clientSignature', label: 'Your Signature (Type Name)', type: 'text', required: true },
    ]
  },
  {
    id: 'payment-terms',
    title: 'Payment & Cancellation Terms',
    description: 'Clarify payment schedule and cancellation policy',
    fields: [
      { name: 'clientName', label: 'Your Name', type: 'text', required: true },
      { name: 'artistName', label: 'Artist/Performer Name', type: 'text', required: true },
      { name: 'totalCost', label: 'Total Cost ($)', type: 'number', required: true },
      { name: 'depositAmount', label: 'Deposit Amount ($)', type: 'number', required: true },
      { name: 'depositDueDate', label: 'Deposit Due Date', type: 'date', required: true },
      { name: 'balanceDueDate', label: 'Balance Due Date', type: 'date', required: true },
      { name: 'cancellationPolicy', label: 'Cancellation Policy Details', type: 'textarea', required: true },
      { name: 'refundPolicy', label: 'Refund Policy Details', type: 'textarea', required: false },
    ]
  }
];

export default function Contracts() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('artist');
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [blankMode, setBlankMode] = useState(false);

  const contracts = activeTab === 'artist' ? ARTIST_CONTRACTS : CLIENT_CONTRACTS;
  const currentContract = contracts.find(c => c.id === selectedContract);

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreFill = () => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        artistName: user.name || '',
        clientName: user.name || '',
      }));
    }
  };

  const generatePDF = async (blank: boolean = false) => {
    if (!currentContract) return;

    const { jsPDF } = await import('jspdf') as any;
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.text(currentContract.title, 20, yPosition);
    yPosition += 15;

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
    yPosition += 10;

    // Form fields
    doc.setFontSize(11);
    currentContract.fields.forEach(field => {
      const value = blank ? '___________________________' : (formData[field.name] || '___________________________');
      doc.text(`${field.label}: ${value}`, 20, yPosition);
      yPosition += 8;

      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    // Signature line
    yPosition += 10;
    doc.text('Signature: ___________________________', 20, yPosition);
    yPosition += 8;
    doc.text('Date: ___________________________', 20, yPosition);

    // Download
    const filename = `${currentContract.id}-${blank ? 'blank' : 'filled'}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Professional Contracts</h1>
          <p className="text-lg text-gray-600">Download customizable contracts for your events</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="artist">🎤 Artist Contracts</TabsTrigger>
            <TabsTrigger value="client">👥 Client Contracts</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {!selectedContract ? (
              // Contract Selection
              <div className="grid gap-4">
                {contracts.map(contract => (
                  <Card
                    key={contract.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedContract(contract.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            {contract.title}
                          </CardTitle>
                          <CardDescription>{contract.description}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                          Select
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              // Contract Form
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{currentContract?.title}</CardTitle>
                      <CardDescription>{currentContract?.description}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedContract(null);
                        setFormData({});
                        setShowPreview(false);
                      }}
                    >
                      ← Back
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Pre-fill Button */}
                  {user && (
                    <Button onClick={handlePreFill} variant="secondary" className="w-full">
                      Pre-fill with My Info
                    </Button>
                  )}

                  {/* Blank Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="blankMode"
                      checked={blankMode}
                      onChange={(e) => setBlankMode(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="blankMode" className="text-sm text-gray-700">
                      Use blank template (don't pre-fill)
                    </label>
                  </div>

                  {/* Form Fields */}
                  {!showPreview && !blankMode && (
                    <div className="space-y-4">
                      {currentContract?.fields.map(field => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <Textarea
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              rows={3}
                            />
                          ) : (
                            <Input
                              type={field.type}
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview */}
                  {showPreview && (
                    <div className="bg-gray-50 p-6 rounded-lg space-y-3 max-h-96 overflow-y-auto">
                      <h3 className="font-semibold text-gray-900">Preview</h3>
                      {currentContract?.fields.map(field => (
                        <div key={field.name} className="text-sm">
                          <span className="font-medium text-gray-700">{field.label}:</span>
                          <span className="text-gray-600 ml-2">{formData[field.name] || '(empty)'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      onClick={() => setShowPreview(!showPreview)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Hide Preview' : 'Preview'}
                    </Button>
                    <Button
                      onClick={() => generatePDF(false)}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Download className="w-4 h-4" />
                      Download Filled PDF
                    </Button>
                    <Button
                      onClick={() => generatePDF(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Blank PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* SEO Content */}
        <div className="mt-16 bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Use Professional Contracts?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">✓ Protect Yourself</h3>
              <p className="text-gray-600">Clear terms prevent misunderstandings and disputes</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">✓ Look Professional</h3>
              <p className="text-gray-600">Impress clients with polished, branded agreements</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">✓ Save Time</h3>
              <p className="text-gray-600">No need to create contracts from scratch</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
