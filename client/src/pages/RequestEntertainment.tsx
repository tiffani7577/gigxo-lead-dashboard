import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Inbound lead capture feature
 * Public form for users to submit event requests directly to Gigxo
 */
export default function RequestEntertainment() {
  const [formData, setFormData] = useState({
    eventType: "",
    eventDate: "",
    city: "",
    budget: "",
    description: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitMutation = trpc.inbound.submitEventRequest.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.eventType) {
      toast.error("Please select an event type");
      return;
    }
    if (!formData.eventDate) {
      toast.error("Please select an event date");
      return;
    }
    if (!formData.city) {
      toast.error("Please enter a city");
      return;
    }
    if (!formData.description || formData.description.length < 10) {
      toast.error("Please provide a description (at least 10 characters)");
      return;
    }
    if (!formData.contactName) {
      toast.error("Please enter your name");
      return;
    }
    if (!formData.contactEmail) {
      toast.error("Please enter your email");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitMutation.mutateAsync({
        eventType: formData.eventType as "wedding" | "birthday" | "corporate" | "party" | "other",
        eventDate: new Date(formData.eventDate).toISOString(),
        city: formData.city,
        budget: formData.budget ? parseInt(formData.budget) * 100 : undefined, // Convert to cents
        description: formData.description,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone || undefined,
      });

      toast.success(result.message);

      // Reset form
      setFormData({
        eventType: "",
        eventDate: "",
        city: "",
        budget: "",
        description: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
      });
    } catch (error) {
      toast.error("Failed to submit your request. Please try again.");
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Find a DJ or Band for Your Event</h1>
          <p className="text-lg text-muted-foreground">
            Submit your event details and we'll connect you with talented performers in your area
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Request Form</CardTitle>
            <CardDescription>Fill out the details about your event</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Event Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Type *</label>
                <Select value={formData.eventType} onValueChange={(value) => handleSelectChange("eventType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="birthday">Birthday Party</SelectItem>
                    <SelectItem value="corporate">Corporate Event</SelectItem>
                    <SelectItem value="party">Private Party</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Date *</label>
                <Input
                  type="datetime-local"
                  name="eventDate"
                  value={formData.eventDate}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* City */}
              <div className="space-y-2">
                <label className="text-sm font-medium">City / Location *</label>
                <Input
                  type="text"
                  name="city"
                  placeholder="e.g., Miami, FL"
                  value={formData.city}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Budget */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Budget (USD) - Optional</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    name="budget"
                    placeholder="e.g., 500"
                    value={formData.budget}
                    onChange={handleChange}
                    min="0"
                    step="50"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Description *</label>
                <Textarea
                  name="description"
                  placeholder="Tell us about your event, what type of entertainment you're looking for, atmosphere, special requests, etc."
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  required
                />
              </div>

              {/* Contact Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name *</label>
                <Input
                  type="text"
                  name="contactName"
                  placeholder="Full name"
                  value={formData.contactName}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address *</label>
                <Input
                  type="email"
                  name="contactEmail"
                  placeholder="your@email.com"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number - Optional</label>
                <Input
                  type="tel"
                  name="contactPhone"
                  placeholder="(555) 123-4567"
                  value={formData.contactPhone}
                  onChange={handleChange}
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                * Required fields. Our team will review your request and connect you with available performers.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
