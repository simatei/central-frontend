import Form from '../../../src/presenters/form';
import SubmissionAnalyze from '../../../src/components/submission/analyze.vue';
import SubmissionList from '../../../src/components/submission/list.vue';
import testData from '../../data';
import { mockHttp } from '../../util/http';
import { mockLogin } from '../../util/session';
import { mount } from '../../util/lifecycle';
import { trigger } from '../../util/event';

const clickTab = (wrapper, tabText) => {
  for (const a of wrapper.find('#submission-analyze .nav-tabs a')) {
    if (a.text().trim() === tabText)
      return trigger.click(a).then(() => wrapper);
  }
  throw new Error('tab not found');
};

describe('SubmissionAnalyze', () => {
  beforeEach(mockLogin);

  it('disables the button for an encrypted form without submissions', () => {
    const key = testData.standardKeys.createPast(1, { managed: false }).last();
    // The button should be disabled even if just the form, not the project, has
    // encryption enabled.
    const form = testData.extendedForms
      .createPast(1, { key, submissions: 0 })
      .last();

    return mockHttp()
      .mount(SubmissionList, {
        propsData: {
          baseUrl: '/v1/projects/1/forms/f',
          formVersion: new Form(form)
        }
      })
      .respondWithData(() => []) // keys
      .respondWithData(() => testData.extendedForms.last()._fields)
      .respondWithData(testData.submissionOData)
      .afterResponses(component => {
        const button = component.first('#submission-list-analyze-button');
        button.should.be.disabled();
        button.getAttribute('title').length.should.not.equal(0);
      });
  });

  it('disables the button if a Key is returned', () => {
    testData.extendedProjects.createPast(1, {
      forms: 2,
      lastSubmission: new Date().toISOString()
    });
    const form = testData.extendedForms
      .createPast(1, { submissions: 1 })
      .last();
    return mockHttp()
      .mount(SubmissionList, {
        propsData: {
          baseUrl: '/v1/projects/1/forms/f',
          formVersion: new Form(form)
        }
      })
      .respondWithData(() =>
        // The button should be disabled even if the key is not managed.
        testData.standardKeys.createPast(1, { managed: false }).sorted())
      .respondWithData(() => form._fields)
      .respondWithData(() => {
        testData.extendedSubmissions.createPast(1, { status: 'NotDecrypted' });
        return testData.submissionOData();
      })
      .afterResponses(component => {
        const button = component.first('#submission-list-analyze-button');
        button.should.be.disabled();
        button.getAttribute('title').length.should.not.equal(0);
      });
  });

  it('shows the modal after the button is clicked', () => {
    const form = testData.extendedForms.createPast(1).last();
    return mockHttp()
      .mount(SubmissionList, {
        propsData: {
          baseUrl: '/v1/projects/1/forms/f',
          formVersion: new Form(form)
        }
      })
      .respondWithData(() => testData.standardKeys.sorted())
      .respondWithData(() => form._fields)
      .respondWithData(testData.submissionOData)
      .testModalToggles(
        SubmissionAnalyze,
        '#submission-list-analyze-button',
        '.btn-primary'
      );
  });

  describe('tool info', () => {
    let modal;
    beforeEach(() => {
      modal = mount(SubmissionAnalyze, {
        propsData: { state: true, baseUrl: '/v1/projects/1/forms/f' }
      });
    });

    const assertContent = (tabText, urlSuffix, helpSubstring) => {
      // Test the text of the active tab.
      const activeTab = modal.first('.nav-tabs li.active');
      activeTab.first('a').text().trim().should.equal(tabText);
      // Test the OData URL.
      const actualURL = modal.first('#submission-analyze-odata-url .selectable').text();
      const baseURL = `${window.location.origin}/v1/projects/1/forms/f.svc`;
      actualURL.should.equal(`${baseURL}${urlSuffix}`);
      // Test the help text.
      const help = modal.first('#submission-analyze-tool-help');
      help.text().iTrim().should.containEql(helpSubstring);
    };

    it('defaults to the Excel/Power BI tab', () => {
      assertContent('Excel/Power BI', '', 'For help using OData with Excel,');
    });

    it('renders the Excel/Power BI tab correctly', () =>
      clickTab(modal, 'R')
        .then(() => clickTab(modal, 'Excel/Power BI'))
        .then(() => {
          assertContent('Excel/Power BI', '', 'For help using OData with Excel,');
        }));

    it('renders the R tab correctly', () =>
      clickTab(modal, 'R').then(() => {
        assertContent('R', '', 'from R,');
      }));

    it('renders the Other tab correctly', () =>
      clickTab(modal, 'Other').then(() => {
        assertContent('Other', '', 'For a full description of our OData support,');
      }));
  });
});
