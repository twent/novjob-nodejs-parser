import { JSDOM } from 'jsdom'
import { queue } from 'async'
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

import { saveToCsv, dateFromString } from './src/modules/utils.js'

dotenv.config()
const prisma = new PrismaClient()

const baseUrl = process.env.BASE_URL
const startPageNumber = process.env.START_PAGE_NUMBER
const workersCount = process.env.WORKERS_COUNT
const timeoutBetweenTasks = process.env.TIMEOUT_BETWEEN_TASKS

// Delay beetween tasks
const delayBetweenTasks = async (ms = timeoutBetweenTasks) =>
	await new Promise(resolve => setTimeout(resolve, ms))

const parsingQueue = queue(async (data, done) => {
	await delayBetweenTasks()
	await worker(data, done)
}, workersCount)

/**
 * @param {object} data - task data
 * @param {function():void} done - callback for task finish
 */
const worker = async (data, done) => {
	await parse(data.url, data.isDetailed && data.isDetailed, data.isFirstPage && data.isFirstPage)

	done()
}

const getDOM = async url => {
	let dom = await JSDOM.fromURL(url).catch(e => console.error(e.message))

	if (!dom) {
		return console.error('Не удалось загрузить страницу')
	}

	return dom
}

/**
 * Categories parsing
 *
 * @param {string} url
 */
const parseCategories = async url => {
	console.info('Обработка категорий')
	let dom = await getDOM(url)

	if (!dom) return

	let htmlDoc = dom.window.document
	let categories = htmlDoc.querySelectorAll('div.catalog > a')
	let categoriesData = []

	categories.forEach(category => {
		let id = Number(category.href.split('=').pop())

		categoriesData.push({
			id: id,
			title: category.textContent.trim()
		})
	})

	if (categoriesData.length > 0) {
		saveToCsv('./data/categories.csv', categoriesData)

		let result = await prisma.category.createMany({
			data: categoriesData,
			skipDuplicates: true
		})

		let message = result.count === 0 ? 'Данные актуальны' : `Сохранено ${result.count} записей`

		console.info(message)
	}
}

/**
 * Main function for parsing
 *
 * @param {string} url
 * @param {boolean} isDetailed
 * @return {Promise<void>}
 */
async function parse(url, isDetailed = false, isFirstPage = false) {
	// Firstly parse categories
	if (isFirstPage) {
		await parseCategories(url)
	}

	let dom = await getDOM(url)

	if (!dom) return

	let htmlDoc = dom.window.document

	if (!isDetailed) {
		// Catalog pages
		console.info(`Обработка страницы ${url}`)

		let vacancies = htmlDoc.querySelectorAll('div.osn > div > table')

		// Get detailed pages links
		vacancies.forEach(vacancy => {
			let link = vacancy.querySelector('a.hdr')

			if (link) {
				let detailedUrl = baseUrl + link.getAttribute('href').substring(2)

				parsingQueue.push({ url: detailedUrl, isDetailed: true })
			}
		})

		// Get next page url
		let next = htmlDoc.querySelector('div.gr_c').nextSibling.firstChild.firstChild

		if (next) {
			let nextPageUrl = baseUrl + next.getAttribute('href').substring(2)
			// Check for last page
			if (nextPageUrl !== url) parsingQueue.push({ url: nextPageUrl })
		}
	} else {
		// Detailed pages
		console.info(`Обработка карточки ${url}`)

		let id = Number(url.split('=').pop())
		let title = htmlDoc.querySelector('td > h3').textContent.trim()

		let publishedAt = htmlDoc
			.querySelector('tbody > tr:nth-child(2) > td > b')
			.firstChild.textContent.trim()
		publishedAt = dateFromString(publishedAt)

		let categoryIds = []
		let categoryLinks = htmlDoc.querySelectorAll('a.razdel')

		categoryLinks.forEach(categoryLink => {
			categoryIds.push({
				id: Number(categoryLink.href.split('=').pop())
			})
		})

		let contacts = htmlDoc
			.querySelector('div.details_plus > table > tbody > tr:last-child')
			.firstElementChild.textContent.trim()

		let salary = htmlDoc
			.querySelector('div.details_plus > table > tbody > tr:nth-last-child(2)')
			.firstElementChild.textContent.trim()

		let detailsData = ''
		let detailRows = htmlDoc.querySelectorAll(
			'div.details_plus > table > tbody > tr:nth-child(n+3):nth-last-child(n+3)'
		)

		detailRows.forEach((tr, index, rows) => {
			detailsData += tr.firstElementChild.textContent.trim()
			if (index !== rows.length - 1) detailsData += '\n'
		})

		let result = await prisma.vacancy
			.upsert({
				select: { id: true },
				where: {
					id: id
				},
				create: {
					id: id,
					title: title,
					salary: salary,
					details: detailsData,
					contacts: contacts,
					publishedAt: publishedAt,
					categories: { connect: categoryIds }
				},
				update: {
					title: title,
					salary: salary,
					details: detailsData,
					contacts: contacts,
					publishedAt: publishedAt,
					categories: { connect: categoryIds }
				}
			})
			.catch(async e => {
				console.error(e)
				await prisma.$disconnect()
				process.exit(1)
			})

		console.info(`Сохранена в БД (${url})`)
	}
}

// Callback for end queue
parsingQueue.drain(async () => {
	let data = await prisma.vacancy
		.findMany({
			include: {
				categories: {
					select: {
						title: true
					}
				}
			}
		})
		.catch(async e => {
			console.error(e)
			await prisma.$disconnect()
			process.exit(1)
		})

	saveToCsv('./data/vacancies.csv', data)
	console.info(`Сохранено ${data.length} записей`)
})

// Push first page to queue
parsingQueue.push({ url: `${baseUrl}job.php?page=${startPageNumber}`, isFirstPage: true })
