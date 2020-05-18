/*
 * Copyright 2020 balena.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';

import * as settings from '../../../lib/gui/app/models/settings';
import {
	fromFlashState,
	ProgressStatusType,
} from '../../../lib/gui/app/modules/progress-status';

function getProgressLabel({
	status,
	...rest
}: ProgressStatusType): ProgressStatusType {
	return {
		status,
		...rest,
	} as ProgressStatusType;
}

describe('Browser: progressStatus', function () {
	describe('.fromFlashState()', function () {
		beforeEach(function () {
			this.state = {
				active: 1,
				type: 'flashing',
				failed: 0,
				percentage: 0,
				eta: 15,
				speed: 100000000000000,
			};

			settings.set('unmountOnSuccess', true);
			settings.set('validateWriteOnSuccess', true);
		});

		it('should report 0% if percentage == 0 but speed != 0', function () {
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'flashing',
					percentage: 0,
				}),
			);
		});

		it('should handle percentage == 0, flashing, unmountOnSuccess', function () {
			this.state.speed = 0;
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'flashing',
					percentage: 0,
				}),
			);
		});

		it('should handle percentage == 0, flashing, !unmountOnSuccess', function () {
			this.state.speed = 0;
			settings.set('unmountOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'flashing',
					percentage: 0,
				}),
			);
		});

		it('should handle percentage == 0, verifying, unmountOnSuccess', function () {
			this.state.speed = 0;
			this.state.type = 'verifying';
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'validating',
					percentage: 0,
				}),
			);
		});

		it('should handle percentage == 0, verifying, !unmountOnSuccess', function () {
			this.state.speed = 0;
			this.state.type = 'verifying';
			settings.set('unmountOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'validating',
					percentage: 0,
				}),
			);
		});

		it('should handle percentage == 50, flashing, unmountOnSuccess', function () {
			this.state.percentage = 50;
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'flashing',
					percentage: 50,
				}),
			);
		});

		it('should handle percentage == 50, flashing, !unmountOnSuccess', function () {
			this.state.percentage = 50;
			settings.set('unmountOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'flashing',
					percentage: 50,
				}),
			);
		});

		it('should handle percentage == 50, verifying, unmountOnSuccess', function () {
			this.state.percentage = 50;
			this.state.type = 'verifying';
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					percentage: 50,
					status: 'validating',
				}),
			);
		});

		it('should handle percentage == 50, verifying, !unmountOnSuccess', function () {
			this.state.percentage = 50;
			this.state.type = 'verifying';
			settings.set('unmountOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					percentage: 50,
					status: 'validating',
				}),
			);
		});

		it('should handle percentage == 100, flashing, unmountOnSuccess, validateWriteOnSuccess', function () {
			this.state.percentage = 100;
			expect(fromFlashState(this.state)).to.deep.equal({
				status: 'finishing',
			});
		});

		it('should handle percentage == 100, flashing, unmountOnSuccess, !validateWriteOnSuccess', function () {
			this.state.percentage = 100;
			settings.set('validateWriteOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'finishing',
				}),
			);
		});

		it('should handle percentage == 100, flashing, !unmountOnSuccess, !validateWriteOnSuccess', function () {
			this.state.percentage = 100;
			settings.set('unmountOnSuccess', false);
			settings.set('validateWriteOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'finishing',
				}),
			);
		});

		it('should handle percentage == 100, verifying, unmountOnSuccess', function () {
			this.state.percentage = 100;
			this.state.type = 'verifying';
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'finishing',
				}),
			);
		});

		it('should handle percentage == 100, validating, !unmountOnSuccess', function () {
			this.state.percentage = 100;
			settings.set('unmountOnSuccess', false);
			expect(fromFlashState(this.state)).to.deep.equal(
				getProgressLabel({
					status: 'finishing',
				}),
			);
		});
	});
});
