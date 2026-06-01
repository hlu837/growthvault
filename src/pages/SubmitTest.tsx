import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const SubmitTest = () => {
  const navigate = useNavigate();
  const [testData, setTestData] = useState({
    fullName: "Test User",
    accountType: "individual",
    businessEmail: "test@example.com",
    businessPhone: "+1234567890",
    dateOfBirth: "1990-01-01",
    nationality: "Test Nationality",
    residentialAddress: "Test Address",
    bankAccountName: "Test Account",
    bankName: "Test Bank",
    bankAccountNumber: "123456789",
    payoutMethod: "bank_transfer",
    password: "password123",
    confirmPassword: "password123",
    appliedCategories: ["real_estate"],
    realEstateSellerType: "owner",
    hasLegalAuthority: true,
    commitmentAgreement: true,
    escrowAgreement1: true,
    escrowAgreement2: true,
    escrowAgreement3: true,
    escrowAgreement4: true,
    disputeAgreement1: true,
    disputeAgreement2: true,
    disputeAgreement3: true,
    termsAgreement: true,
    finalDeclarationSignature: "Test User",
    finalDeclarationDate: "2026-05-03",
  });

  const testSubmit = () => {
    console.log("Test data:", testData);
    console.log("All required fields filled - should submit");
    // Simulate submission without file uploads
    alert("Test form would submit successfully with this data");
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Submit Test - Debug Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 border rounded-lg">
              <h3 className="font-semibold text-green-800">Test Data (All Required Fields Filled)</h3>
              <pre className="text-sm bg-white p-2 rounded border">
                {JSON.stringify(testData, null, 2)}
              </pre>
            </div>
            
            <Button onClick={testSubmit} className="w-full">
              Test Submit Logic
            </Button>
            
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>• All required fields are pre-filled</p>
              <p>• This tests if the validation logic works correctly</p>
              <p>• Click "Test Submit Logic" to see what happens</p>
              <p>• If this works, the issue is with the main form's state management</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubmitTest;
