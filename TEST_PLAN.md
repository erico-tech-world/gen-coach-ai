# 🧪 **GEN-COACH Test Plan - Complete System Validation**

## 📋 **Test Overview**

This test plan validates the complete GEN-COACH system after implementing:
- ✅ Payload size validation and file size limits
- ✅ Supabase Storage integration for large files
- ✅ Enhanced Edge Function with improved error handling
- ✅ Database schema updates for file metadata

## 🎯 **Test Objectives**

1. **Verify 500 Error Resolution**: Ensure course generation works without server errors
2. **Validate File Upload System**: Test both inline and cloud storage uploads
3. **Confirm Size Limits**: Verify proper handling of different file sizes
4. **Test Error Handling**: Ensure graceful error messages for edge cases
5. **Validate Duplicate Prevention**: Confirm no duplicate courses are created

## 🧪 **Test Scenarios**

### **Test 1: Small File Upload (≤1MB) - Inline Processing**

#### **Prerequisites**
- User is authenticated
- Small text file available (≤1MB)

#### **Test Steps**
1. Navigate to course creation overlay
2. Enter course topic: "Introduction to JavaScript"
3. Upload a small text file (≤1MB)
4. Click "Generate AI Course"
5. Monitor upload progress and generation process

#### **Expected Results**
- ✅ File uploads successfully with progress bar
- ✅ File content is processed inline (not sent to cloud storage)
- ✅ Course generation completes without 500 errors
- ✅ Course appears in dashboard immediately
- ✅ File metadata shows "(Inline Processing)"

#### **Success Criteria**
- No console errors
- Course generation completes in under 2 minutes
- File content is included in course context

---

### **Test 2: Large File Upload (1-5MB) - Cloud Storage**

#### **Prerequisites**
- User is authenticated
- Large file available (2-3MB)

#### **Test Steps**
1. Navigate to course creation overlay
2. Enter course topic: "Advanced Machine Learning"
3. Upload a large file (2-3MB)
4. Click "Generate AI Course"
5. Monitor upload progress and generation process

#### **Expected Results**
- ✅ File uploads to Supabase Storage with progress bar
- ✅ File metadata shows "(Cloud Storage)"
- ✅ Course generation uses file URL instead of content
- ✅ Course generation completes without 500 errors
- ✅ Course appears in dashboard immediately

#### **Success Criteria**
- File appears in Supabase Storage bucket
- No payload size errors
- Course generation completes successfully

---

### **Test 3: File Size Limit Enforcement (>5MB)**

#### **Prerequisites**
- User is authenticated
- Very large file available (>5MB)

#### **Test Steps**
1. Navigate to course creation overlay
2. Enter course topic: "Data Science Fundamentals"
3. Attempt to upload a file >5MB
4. Observe error handling

#### **Expected Results**
- ✅ Upload is blocked immediately
- ✅ Clear error message: "File too large. Maximum size is 5MB."
- ✅ No file processing occurs
- ✅ Generate button remains disabled

#### **Success Criteria**
- File upload fails gracefully
- User receives clear error message
- No server errors or crashes

---

### **Test 4: Payload Size Validation**

#### **Prerequisites**
- User is authenticated
- Very long text input available

#### **Test Steps**
1. Navigate to course creation overlay
2. Enter extremely long course topic (copy-paste long text)
3. Click "Generate AI Course"
4. Monitor response

#### **Expected Results**
- ✅ Edge Function returns 413 (Payload Too Large)
- ✅ User receives clear error message
- ✅ No server crashes or 500 errors

#### **Success Criteria**
- Proper HTTP status code returned
- User-friendly error message displayed
- System remains stable

---

### **Test 5: Duplicate Course Prevention**

#### **Prerequisites**
- User is authenticated
- Previous course exists

#### **Test Steps**
1. Navigate to course creation overlay
2. Enter the same topic as an existing course
3. Click "Generate AI Course"
4. Observe duplicate prevention

#### **Expected Results**
- ✅ System detects duplicate course
- ✅ Returns 409 (Conflict) status
- ✅ Clear message: "Course already exists"
- ✅ No duplicate course created

#### **Success Criteria**
- Duplicate detection works correctly
- User receives appropriate error message
- Database integrity maintained

---

### **Test 6: Edge Function Error Handling**

#### **Prerequisites**
- User is authenticated
- Edge Function logs accessible

#### **Test Steps**
1. Monitor Edge Function logs during various operations
2. Check for proper error logging
3. Verify error responses include helpful details

#### **Expected Results**
- ✅ Structured error logging with stack traces
- ✅ Proper HTTP status codes returned
- ✅ User-friendly error messages
- ✅ No 500 errors for valid requests

#### **Success Criteria**
- Comprehensive error logging
- Proper error categorization
- Helpful debugging information

---

### **Test 7: File Cleanup on Course Deletion**

#### **Prerequisites**
- User is authenticated
- Course with uploaded file exists

#### **Test Steps**
1. Navigate to course dashboard
2. Delete a course that has an uploaded file
3. Check Supabase Storage bucket
4. Verify file cleanup

#### **Expected Results**
- ✅ Course is deleted successfully
- ✅ Associated file is removed from storage
- ✅ No orphaned files remain

#### **Success Criteria**
- Complete cleanup of course and files
- Storage bucket remains organized
- No storage leaks

---

### **Test 8: Mobile Responsiveness**

#### **Prerequisites**
- Mobile device or browser dev tools
- User is authenticated

#### **Test Steps**
1. Access course creation on mobile device
2. Test file upload functionality
3. Verify UI elements are properly sized
4. Test course generation process

#### **Expected Results**
- ✅ UI elements are properly sized for mobile
- ✅ File upload works on mobile devices
- ✅ Progress bars and error messages are visible
- ✅ Touch interactions work correctly

#### **Success Criteria**
- Full mobile compatibility
- No UI overflow issues
- Smooth mobile user experience

---

### **Test 9: Performance and Load Testing**

#### **Prerequisites**
- User is authenticated
- Multiple files of different sizes available

#### **Test Steps**
1. Upload multiple files in sequence
2. Generate courses with different file types
3. Monitor system performance
4. Check for memory leaks or slowdowns

#### **Expected Results**
- ✅ System handles multiple uploads gracefully
- ✅ No performance degradation
- ✅ Memory usage remains stable
- ✅ Response times remain consistent

#### **Success Criteria**
- Stable performance under load
- No memory leaks
- Consistent response times

---

### **Test 10: Error Recovery and Resilience**

#### **Prerequisites**
- User is authenticated
- Network conditions can be simulated

#### **Test Steps**
1. Simulate network interruptions during upload
2. Test Edge Function timeout scenarios
3. Verify system recovery behavior
4. Check error state handling

#### **Expected Results**
- ✅ System recovers gracefully from errors
- ✅ User receives helpful error messages
- ✅ No data corruption occurs
- ✅ System returns to stable state

#### **Success Criteria**
- Robust error recovery
- Clear user feedback
- System stability maintained

## 📊 **Test Results Tracking**

### **Test Execution Log**

| Test # | Test Name | Status | Notes | Tester | Date |
|--------|-----------|--------|-------|--------|------|
| 1 | Small File Upload | ⏳ Pending | | | |
| 2 | Large File Upload | ⏳ Pending | | | |
| 3 | File Size Limits | ⏳ Pending | | | |
| 4 | Payload Validation | ⏳ Pending | | | |
| 5 | Duplicate Prevention | ⏳ Pending | | | |
| 6 | Error Handling | ⏳ Pending | | | |
| 7 | File Cleanup | ⏳ Pending | | | |
| 8 | Mobile Responsiveness | ⏳ Pending | | | |
| 9 | Performance Testing | ⏳ Pending | | | |
| 10 | Error Recovery | ⏳ Pending | | | |

### **Status Legend**
- ⏳ Pending: Test not yet executed
- ✅ Passed: Test completed successfully
- ❌ Failed: Test failed, issue identified
- 🔄 Retest: Test needs to be re-run after fix

## 🚨 **Critical Test Cases**

### **Must Pass (Blocking Issues)**
- **Test 1**: Small File Upload - Inline Processing
- **Test 2**: Large File Upload - Cloud Storage
- **Test 3**: File Size Limit Enforcement
- **Test 5**: Duplicate Course Prevention

### **Should Pass (Important Features)**
- **Test 4**: Payload Size Validation
- **Test 6**: Error Handling
- **Test 7**: File Cleanup
- **Test 8**: Mobile Responsiveness

### **Nice to Have (Enhancements)**
- **Test 9**: Performance Testing
- **Test 10**: Error Recovery

## 📋 **Test Environment Requirements**

### **Browser Testing**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### **Device Testing**
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

### **File Types**
- Text files (.txt, .md)
- Word documents (.doc, .docx)
- PDF files (.pdf)

### **File Sizes**
- Small: 100KB - 1MB
- Medium: 1MB - 3MB
- Large: 3MB - 5MB
- Oversized: >5MB

## 🔍 **Debugging Information**

### **Console Logs to Monitor**
- File upload progress
- Course generation requests
- Error messages and stack traces
- Network request/response details

### **Edge Function Logs**
- Request payload sizes
- File processing steps
- Database operations
- Error occurrences

### **Storage Monitoring**
- File upload success/failure
- Bucket organization
- File access patterns
- Cleanup operations

## ✅ **Test Completion Checklist**

- [ ] All critical tests pass
- [ ] No 500 errors during course generation
- [ ] File uploads work for all supported sizes
- [ ] Duplicate prevention functions correctly
- [ ] Error handling provides clear user feedback
- [ ] Mobile experience is satisfactory
- [ ] Performance meets expectations
- [ ] File cleanup works properly
- [ ] Edge Function logs show successful operations
- [ ] Database schema updates are verified

---

**Test Plan Version**: 1.0  
**Last Updated**: August 23, 2025  
**Status**: Ready for Execution  
**Priority**: High (Critical System Validation)
